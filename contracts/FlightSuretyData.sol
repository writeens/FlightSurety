pragma solidity ^0.5.0;

import "../node_modules/openzeppelin-solidity/contracts/math/SafeMath.sol";

contract FlightSuretyData {
    using SafeMath for uint256;

    /********************************************************************************************/
    /*                                       DATA VARIABLES                                     */
    /********************************************************************************************/

    address private contractOwner;                                      // Account used to deploy contract
    bool private operational = true;                                    // Blocks all state changes throughout the contract if false
    mapping (address=>bool) private authorizedCallers;                  // Checks whether address is authorized or not

    /********************************************************************************************/
    /*                                       EVENT DEFINITIONS                                  */
    /********************************************************************************************/
    // event to trigger when airline gets registered
    event AirlineRegistered( address airlineAccount, string airlineName );
    
    // event to trigger when insurance is purchased
    event InsurancePurchased(
        address passengerAccount,
        uint256 amount,
        address airlineAccount,
        string airlineName
    );

    // event to trigger when insurance credit is available
    event InsuranceCreditAvailable(
        address airlineAccount,
        string airlineName
    );

    // event to trigger when insurance credit is paid to passenger
    event InsurancePaid(
        address passengerAddress, 
        uint256 payableAmount
    );

    // event to trigger when airline is funded
    event AirlineFunded(address airlineAddress, uint256 amount);
    event FlightRegistered(address airlineAddress, string name);
    event Log256(uint256 val);
    event LogString(string val);
    event LogAddress(address val);
    event LogB32(bytes32 val);


    /**
    * @dev Constructor
    *      The deploying account becomes contractOwner
    */
    constructor
                                (
                                ) 
                                public 
    {
        contractOwner = msg.sender;
        authorizedCallers[contractOwner] = true; //Add contract owner as authorized caller
    }

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
        require(operational, "Contract is currently not operational");
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

    modifier requireAuthorizedCaller() {
        require(
            authorizedCallers[msg.sender] == true,
            "Caller is not authorized"
        );
        _;
    }

    modifier requireMsgData() {
        require(
            msg.data.length > 0,
            "Message data is absent"
        );
        _;
    }

    modifier requireIsAirline() {
        require(airlines[msg.sender].isRegistered == true, "Caller is not airline");
        _;
    }

    /********************************************************************************************/
    /*                                       UTILITY FUNCTIONS                                  */
    /********************************************************************************************/

    /**
    * @dev Get operating status of contract
    *
    * @return A bool that is the current operating status
    */      
    function isOperational() 
                            public 
                            view 
                            returns(bool) 
    {
        return operational;
    }


    /**
    * @dev Sets contract operations on/off
    *
    * When operational mode is disabled, all write transactions except for this one will fail
    */    
    function setOperatingStatus
                            (
                                bool mode
                            ) 
                            external
                            requireAuthorizedCaller
    {
        operational = mode;
    }

    function authorizeCaller(address _address)
        external
        requireIsOperational
        requireContractOwner
    {
        authorizedCallers[_address] = true;
    }

    function deauthorizeCaller(address _address)
        external
        requireIsOperational
        requireContractOwner
    {
        delete authorizedCallers[_address];
    }

    /********************************************************************************************/
    /*                                     SMART CONTRACT VARIABLES                             */
    /********************************************************************************************/

    // Structs
    struct Airline {
        address airlineAccount; // account address of airline
        string name; // name of airline
        bool isRegistered; // is this airline registered or not
        bool isFunded; // is this airline funded or not
        bool isNominated; // is this airline nominated or not
        uint256 fund; // amount of fund available
    }

    struct Insurance {
        mapping(address => uint256) amount; //Address and Amount
        address[] passengers;
        bool isPaid;
        
    }
    struct Flight {
        bool isRegistered;
        uint8 statusCode;
        uint256 updatedTimestamp;        
        address airline;
    }
    
    //Flight Key to Flight
    mapping(bytes32 => Flight) private flights;

    //Flight Key to Insurance
    mapping(bytes32 => Insurance) private insurance;
    //Address to Airline Struct
    mapping(address => Airline) private airlines;
    mapping(address => uint256) private passengerBalance;

    uint256 internal numberOfRegisteredAirlines = 0;

    /********************************************************************************************/
    /*                                     SMART CONTRACT FUNCTIONS                             */
    /********************************************************************************************/

   /**
    * @dev Add an airline to the registration queue
    *      Can only be called from FlightSuretyApp contract
    *
    */   
    function registerAirline
                            (   
                                address airlineAddress,
                                string calldata airlineName
                            )
                            external
                            requireIsOperational
                            requireAuthorizedCaller
                            
    {
        numberOfRegisteredAirlines = numberOfRegisteredAirlines.add(1);
        airlines[airlineAddress] = Airline(airlineAddress, airlineName, true, false, false, 0);
        emit AirlineRegistered(airlineAddress, airlineName);
    }

    function getAirlineFunds(address airlineAddress)
        external
        view
        requireIsOperational
        requireAuthorizedCaller
        returns (uint256)
    {
        return airlines[airlineAddress].fund;
    }

    function nominateAirline(address airlineAddress)
        external
        requireIsOperational
        requireAuthorizedCaller
    {
        airlines[airlineAddress].isNominated = true;
    }

   /**
    * @dev Buy insurance for a flight
    *
    */   
    function buyInsurance
                            (
                                address passengerAddress,
                                uint256 insuranceAmount,
                                bytes32 flightKey,
                                address airlineAddress                          
                            )
                            external
                            requireIsOperational
                            requireAuthorizedCaller
    {
        airlines[airlineAddress].fund.add(insuranceAmount);
        insurance[flightKey].amount[passengerAddress] = insuranceAmount;
        insurance[flightKey].passengers.push(passengerAddress);
        emit InsurancePurchased(passengerAddress, insuranceAmount, airlineAddress, airlines[airlineAddress].name);
    }

    /**
     *  @dev Credits payouts to insurees
    */
    function creditInsurees
                                (
                                    bytes32 flightKey, address airlineAddress
                                )
                                external
                                requireIsOperational
                                requireAuthorizedCaller
    {
        require(!insurance[flightKey].isPaid, 'Insurance has already been paid');
        for(uint i = 0; i < insurance[flightKey].passengers.length; i++){
            address passengerAddress = insurance[flightKey].passengers[i];
            uint256 insuranceAmount = insurance[flightKey].amount[passengerAddress];
            uint256 payoutAmount = insuranceAmount.mul(3).div(2);

            passengerBalance[passengerAddress] = passengerBalance[passengerAddress].add(payoutAmount);
            
            airlines[airlineAddress].fund.sub(payoutAmount);
        }
        insurance[flightKey].isPaid = true;
        emit InsuranceCreditAvailable(airlineAddress, airlines[airlineAddress].name);
    }
    

    /**
     *  @dev Transfers eligible payout funds to insuree
     *
    */
    function payPassenger
                            (
                                address payable passengerAddress
                            )
                            external
                            requireIsOperational
                            requireAuthorizedCaller
    {
        uint256 payableAmount = passengerBalance[passengerAddress];
        delete(passengerBalance[passengerAddress]);
        passengerAddress.transfer(payableAmount);

        emit InsurancePaid(passengerAddress, payableAmount);
    }

   /**
    * @dev Initial funding for the insurance. Unless there are too many delayed flights
    *      resulting in insurance payouts, the contract should be self-sustaining
    *
    */   
    function fundAirline
                            (
                                address airlineAddress, uint256 amount
                            )
                            external
                            requireIsOperational
                            requireAuthorizedCaller
    {
        airlines[airlineAddress].fund = airlines[airlineAddress].fund.add(amount);
        airlines[airlineAddress].isFunded = true;

        emit AirlineFunded(airlineAddress, amount);
    }



    function registerFlight(
        address airline,
        string calldata flight,
        uint256 departureTime,
        uint8 statusCode
    ) external requireIsOperational requireAuthorizedCaller returns(bool isRegistered) {
        bytes32 key = getFlightKey(airline, flight, departureTime);
        flights[key] = Flight({
           isRegistered: true,
           airline: airline,
           updatedTimestamp: departureTime,
           statusCode: statusCode
        });
        emit LogB32(key);
        emit FlightRegistered(airline, flight);
        return flights[key].isRegistered;
    }

    function updateFlightStatus(
        uint8 statusCode,
        bytes32 flightKey
    ) external requireIsOperational requireAuthorizedCaller {
        flights[flightKey].statusCode = statusCode;
    }

    function isFlightRegistered(
        bytes32 flightKey
    ) external view requireIsOperational requireAuthorizedCaller returns (bool) {
        return flights[flightKey].isRegistered == true;
    }

    function getFlightStatus(
        bytes32 flightKey
    ) external view requireIsOperational requireAuthorizedCaller returns (uint8) {
        return flights[flightKey].statusCode;
    }

    function getPassengerBalance(address passengerAddress) external view
        requireIsOperational
        requireAuthorizedCaller
        returns(uint256)
    {
        return passengerBalance[passengerAddress];
    }

    function isAirlineFunded(address airlineAddress)
        external
        view
        requireIsOperational
        requireAuthorizedCaller
        returns (bool)
    {
        return airlines[airlineAddress].isFunded == true;
    }

    function isAirlineRegistered(address airlineAddress)
        external
        view
        requireIsOperational
        requireAuthorizedCaller
        returns (bool)
    {
        return airlines[airlineAddress].isRegistered == true;
    }

    function isAirlineNominated(address airlineAddress)
        external
        view
        requireIsOperational
        requireAuthorizedCaller
        returns (bool)
    {
        return airlines[airlineAddress].isNominated == true;
    }

    function getNumberOfRegisteredAirlines()
    external
    view
    returns(uint256) {
        return numberOfRegisteredAirlines;
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

    function() external payable {
            // React to receiving ether
        }
}

