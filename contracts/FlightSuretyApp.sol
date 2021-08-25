pragma solidity ^0.5.0;

// It's important to avoid vulnerabilities due to numeric overflow bugs
// OpenZeppelin's SafeMath library, when used correctly, protects agains such bugs
// More info: https://www.nccgroup.trust/us/about-us/newsroom-and-events/blog/2018/november/smart-contract-insecurity-bad-arithmetic/

import "../node_modules/openzeppelin-solidity/contracts/math/SafeMath.sol";
import "./FlightSuretyData.sol";

/************************************************** */
/* FlightSurety Smart Contract                      */
/************************************************** */
contract FlightSuretyApp {
    using SafeMath for uint256; // Allow SafeMath functions to be called for all uint256 types (similar to "prototype" in Javascript)

    /********************************************************************************************/
    /*                                       DATA VARIABLES                                     */
    /********************************************************************************************/

    // Flight status codees
    uint8 private constant STATUS_CODE_UNKNOWN = 0;
    uint8 private constant STATUS_CODE_ON_TIME = 10;
    uint8 private constant STATUS_CODE_LATE_AIRLINE = 20;
    uint8 private constant STATUS_CODE_LATE_WEATHER = 30;
    uint8 private constant STATUS_CODE_LATE_TECHNICAL = 40;
    uint8 private constant STATUS_CODE_LATE_OTHER = 50;

    uint256 private constant CONSENSUS_THRESHOLD = 4;
    uint256 private constant PERCENT_VOTES_NEEDED = 50;

    uint256 public constant MAX_INSURANCE_COST = 1 ether;
    uint256 public constant MIN_AIRLINE_FUNDING = 10 ether;

    address private contractOwner;          // Account used to deploy contract
    address payable public dataContractAddress;

    

    FlightSuretyData internal flightSuretyData;

    struct Vote {
        address votersAddress;
    }

    mapping(address => Vote[]) private airlineVoters;

    /********************************************************************************************/
    /*                                       EVENT DEFINITIONS                                  */
    /********************************************************************************************/
    event AppAirlineRegistered( address indexed airlineAccount, string airlineName );
    event AppAirlineFunded(address airlineAddress, uint256 amount);
    event AppInsurancePurchased(address passengerAccount, uint256 amount, address airlineAccount);
    event AppFlightRegistered(address caller, string flight);
    event AppInsuranceWithdrawal(address passengerAddress);
    event AppInsurancePayout(address airlineAddress, string flight);
    event AppAirlineNominated(address airlineAddress);
    event Log256(uint256 val);
    event LogString(string val);
    event LogAddress(address val);
    event LogB32(bytes32 val);

 
    /********************************************************************************************/
    /*                                       FUNCTION MODIFIERS                                 */
    /********************************************************************************************/

    // Modifiers help avoid duplication of code. They are typically used to validate something
    // before a function is allowed to be executed.

    /**
    * @dev Modifier that requires the "operational" boolean variable to be "true"
    *      This is used on all state changing functions to pause the contract in 
    *      the event there is an issue that needs to be fixed
    */
    modifier requireIsOperational() 
    {
         // Modify to call data contract's status
        require(true, "Contract is currently not operational");  
        _;  // All modifiers require an "_" which indicates where the function body will be added
    }

    /**
    * @dev Modifier that requires the "ContractOwner" account to be the function caller
    */
    modifier requireContractOwner()
    {
        require(msg.sender == contractOwner, "Caller is not contract owner");
        _;
    }

    modifier requireIsAirlineFunded() {
        require(
            flightSuretyData.isAirlineFunded(msg.sender) == true,
            "Airline is not funded"
        );
        _;
    }

    modifier requireNotRegistered(address airlineAddress) {
        require(
            flightSuretyData.isAirlineRegistered(airlineAddress) != true,
            "Airline is already registered"
        );
        _;
    }

    modifier requireRegistered() {
        require(
            flightSuretyData.isAirlineRegistered(msg.sender) == true,
            "Airline is not registered"
        );
        _;
    }

    modifier requireIsNominated(address airlineAddress) {
        require(
            flightSuretyData.isAirlineNominated(airlineAddress) == true,
            "Airline is not nominated"
        );
        _;
    }

    /********************************************************************************************/
    /*                                       CONSTRUCTOR                                        */
    /********************************************************************************************/

    /**
    * @dev Contract constructor
    *
    */
    constructor
                                (
                                    address payable dataContract
                                ) public
    {
        contractOwner = msg.sender;
        dataContractAddress = dataContract;
        flightSuretyData = FlightSuretyData(dataContract);
    }

    /********************************************************************************************/
    /*                                       UTILITY FUNCTIONS                                  */
    /********************************************************************************************/

    function isOperational() 
                            external view 
                            returns(bool) 
    {
        return flightSuretyData.isOperational();  // Modify to call data contract's status
    }

    function setOperatingStatus(bool mode)
        external
        requireContractOwner
        returns (bool status)
    {
        flightSuretyData.setOperatingStatus(mode);
        return flightSuretyData.isOperational();
    }

    /********************************************************************************************/
    /*                                     SMART CONTRACT FUNCTIONS                             */
    /********************************************************************************************/

function isAirlineRegistered(address airlineAddress)
        external
        view
        requireIsOperational
        returns (bool isRegistered)
    {
        return flightSuretyData.isAirlineRegistered(airlineAddress);
    }

function isFlightRegistered(
        address airline,
        string calldata flight,
        uint256 departureTime
    ) external view requireIsOperational returns (bool isRegistered) {
        bytes32 flightKey = getFlightKey(airline, flight, departureTime);
        return flightSuretyData.isFlightRegistered(flightKey);
    }

function getAirlineFunds(address airlineAddress)
        external
        view
        requireIsOperational
        returns (uint256)
    {
        return flightSuretyData.getAirlineFunds(airlineAddress);
    }
  
   /**
    * @dev Add an airline to the registration queue
    *
    */   
    function registerAirline
                            (
                                address airlineAddress,   
                                string calldata airlineName   
                            )
                            external
                            requireIsOperational
                            requireNotRegistered(airlineAddress)
                            requireIsAirlineFunded
                            requireIsNominated(airlineAddress)
                            returns(bool isSuccess, uint256 numberOfVotes)
    {
        bool success = false;
        uint256 votes = voteAirline(airlineAddress, msg.sender);
        uint256 numberOfAirlines = flightSuretyData.getNumberOfRegisteredAirlines();

        if(numberOfAirlines < CONSENSUS_THRESHOLD){
            flightSuretyData.registerAirline(airlineAddress, airlineName);
            success = true;
            emit AppAirlineRegistered(airlineAddress, airlineName);
        } else {
            
            if(votes >= PERCENT_VOTES_NEEDED.mul(numberOfAirlines).div(100)){
                flightSuretyData.registerAirline(airlineAddress, airlineName);
                success = true;
                emit AppAirlineRegistered(airlineAddress, airlineName);
            } else {
                success = false;
            }

        }
        return (success, votes);
    }

    function nominateAirline(address airlineAddress)
        external
        requireIsOperational
    {
        flightSuretyData.nominateAirline(airlineAddress);
        emit AppAirlineNominated(airlineAddress);
    }

    function fundAirline()
        external
        payable
        requireIsOperational
        requireRegistered
    {
        require(
            msg.value >= MIN_AIRLINE_FUNDING,
            "Airline funding requires at least 10 Ether"
        );
        dataContractAddress.transfer(msg.value);
        flightSuretyData.fundAirline(msg.sender, msg.value);
        emit AppAirlineFunded(msg.sender, msg.value);
    }

    /**
    * @dev Vote for airline.
    *
    */ 
    function voteAirline
                                (
                                    address airlineAddress,
                                    address votersAddress
                                )
                                internal
                                requireIsOperational
                                returns (uint256)
    {
        Vote memory newVote = Vote({
            votersAddress:votersAddress
        });
        airlineVoters[airlineAddress].push(newVote);
        return airlineVoters[airlineAddress].length;
    }

    function getNumberAirlineVotes(address airlineAddress)
        external
        view
        requireIsOperational
        returns (uint256)
    {
        return airlineVoters[airlineAddress].length;
    }


    function buyFlightInsurance(
        address airline,
        string calldata flight,
        uint256 timestamp
    )
        external
        payable
        requireIsOperational
    {
        require(msg.value <= MAX_INSURANCE_COST, "Value sent by caller is higher than insurance cost");
        
        bytes32 key = getFlightKey(airline, flight, timestamp);
        flightSuretyData.buyInsurance(msg.sender, msg.value, key, airline);
        dataContractAddress.transfer(msg.value);
        emit AppInsurancePurchased(msg.sender, msg.value, airline);
    }


   /**
    * @dev Register a future flight for insuring.
    *
    */  
    function registerFlight
                                (
                                    string calldata flight,
                                    uint256 departureTime
                                )
                                external
                                requireIsOperational
                                requireIsAirlineFunded
    {
        flightSuretyData.registerFlight(
            msg.sender,
            flight,
            departureTime,
            STATUS_CODE_UNKNOWN
        );
        emit AppFlightRegistered(msg.sender, flight);
    }
    
   /**
    * @dev Called after oracle has updated flight status
    *
    */  
    function processFlightStatus
                                (
                                    address airline,
                                    string memory flight,
                                    uint256 timestamp,
                                    uint8 statusCode
                                )
                                internal
    {
        bytes32 flightKey = getFlightKey(airline, flight, timestamp);
        flightSuretyData.updateFlightStatus(statusCode, flightKey);
        if (statusCode == STATUS_CODE_LATE_AIRLINE) {
            flightSuretyData.creditInsurees(flightKey, airline);
            emit AppInsurancePayout(airline, flight);
        }
    }

    function passengerBalance(address passengerAddress)
        external
        view
        requireIsOperational
        returns (uint256)
    {
        return flightSuretyData.getPassengerBalance(passengerAddress);
    }

    function withdrawBalance()
        external
        requireIsOperational
    {
        flightSuretyData.payPassenger(msg.sender);
        emit AppInsuranceWithdrawal(msg.sender);
    }


    // Generate a request for oracles to fetch flight information
    function fetchFlightStatus
                        (
                            address airline,
                            string calldata flight,
                            uint256 timestamp                            
                        )
                        external
    {
        uint8 index = getRandomIndex(msg.sender);

        // Generate a unique key for storing the request
        bytes32 key = keccak256(abi.encodePacked(index, airline, flight, timestamp));
        oracleResponses[key] = ResponseInfo({
                                                requester: msg.sender,
                                                isOpen: true
                                            });

        emit OracleRequest(index, airline, flight, timestamp);
    } 


// region ORACLE MANAGEMENT

    // Incremented to add pseudo-randomness at various points
    uint8 private nonce = 0;    

    // Fee to be paid when registering oracle
    uint256 public constant REGISTRATION_FEE = 1 ether;

    // Number of oracles that must respond for valid status
    uint256 private constant MIN_RESPONSES = 3;


    struct Oracle {
        bool isRegistered;
        uint8[3] indexes;        
    }

    // Track all registered oracles
    mapping(address => Oracle) private oracles;

    // Model for responses from oracles
    struct ResponseInfo {
        address requester;                              // Account that requested status
        bool isOpen;                                    // If open, oracle responses are accepted
        mapping(uint8 => address[]) responses;          // Mapping key is the status code reported
                                                        // This lets us group responses and identify
                                                        // the response that majority of the oracles
    }

    // Track all oracle responses
    // Key = hash(index, flight, timestamp)
    mapping(bytes32 => ResponseInfo) private oracleResponses;

    // Event fired each time an oracle submits a response
    event FlightStatusInfo(address airline, string flight, uint256 timestamp, uint8 status);

    event OracleReport(address airline, string flight, uint256 timestamp, uint8 status);

    // Event fired when flight status request is submitted
    // Oracles track this and if they have a matching index
    // they fetch data and submit a response
    event OracleRequest(uint8 index, address airline, string flight, uint256 timestamp);


    // Register an oracle with the contract
    function registerOracle
                            (
                            )
                            external
                            payable
    {
        // Require registration fee
        require(msg.value >= REGISTRATION_FEE, "Registration fee is required");

        uint8[3] memory indexes = generateIndexes(msg.sender);

        oracles[msg.sender] = Oracle({
                                        isRegistered: true,
                                        indexes: indexes
                                    });
    }

    function getMyIndexes
                            (
                            )
                            view
                            external
                            returns(uint8[3] memory)
    {
        require(oracles[msg.sender].isRegistered, "Not registered as an oracle");

        return oracles[msg.sender].indexes;
    }




    // Called by oracle when a response is available to an outstanding request
    // For the response to be accepted, there must be a pending request that is open
    // and matches one of the three Indexes randomly assigned to the oracle at the
    // time of registration (i.e. uninvited oracles are not welcome)
    function submitOracleResponse
                        (
                            uint8 index,
                            address airline,
                            string calldata flight,
                            uint256 timestamp,
                            uint8 statusCode
                        )
                        external
    {
        require((oracles[msg.sender].indexes[0] == index) || (oracles[msg.sender].indexes[1] == index) || (oracles[msg.sender].indexes[2] == index), "Index does not match oracle request");


        bytes32 key = keccak256(abi.encodePacked(index, airline, flight, timestamp)); 
        require(oracleResponses[key].isOpen, "Flight or timestamp do not match oracle request");

        oracleResponses[key].responses[statusCode].push(msg.sender);

        // Information isn't considered verified until at least MIN_RESPONSES
        // oracles respond with the *** same *** information
        emit OracleReport(airline, flight, timestamp, statusCode);
        if (oracleResponses[key].responses[statusCode].length >= MIN_RESPONSES) {

            emit FlightStatusInfo(airline, flight, timestamp, statusCode);

            // Handle flight status as appropriate
            processFlightStatus(airline, flight, timestamp, statusCode);
        }
    }


    function getFlightKey
                        (
                            address airline,
                            string memory flight,
                            uint256 timestamp
                        )
                        pure
                        internal
                        returns(bytes32) 
    {
        return keccak256(abi.encodePacked(airline, flight, timestamp));
    }

    // Returns array of three non-duplicating integers from 0-9
    function generateIndexes
                            (                       
                                address account         
                            )
                            internal
                            returns(uint8[3] memory)
    {
        uint8[3] memory indexes;
        indexes[0] = getRandomIndex(account);
        
        indexes[1] = indexes[0];
        while(indexes[1] == indexes[0]) {
            indexes[1] = getRandomIndex(account);
        }

        indexes[2] = indexes[1];
        while((indexes[2] == indexes[0]) || (indexes[2] == indexes[1])) {
            indexes[2] = getRandomIndex(account);
        }

        return indexes;
    }

    // Returns array of three non-duplicating integers from 0-9
    function getRandomIndex
                            (
                                address account
                            )
                            internal
                            returns (uint8)
    {
        uint8 maxValue = 10;

        // Pseudo random number...the incrementing nonce adds variation
        uint8 random = uint8(uint256(keccak256(abi.encodePacked(blockhash(block.number - nonce++), account))) % maxValue);

        if (nonce > 250) {
            nonce = 0;  // Can only fetch blockhashes for last 256 blocks so we adapt
        }

        return random;
    }

// endregion

}   
