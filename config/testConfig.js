var FlightSuretyApp = artifacts.require("FlightSuretyApp");
var FlightSuretyData = artifacts.require("FlightSuretyData");

var Config = async (accounts) => {
  let TEST_ORACLES_COUNT = 20;

  let actors = {
    contractOwner: accounts[0],
    passenger1: accounts[1],
    passenger2: accounts[2],
    passenger3: accounts[3],
    passenger4: accounts[4],
    airline1: accounts[5],
    airline2: accounts[6],
    airline3: accounts[7],
    airline4: accounts[8],
    airline5: accounts[9],
  };

  let flights = [
    [
      actors.airline1,
      "NG 101: NIG-ABCDE",
      new Date(2021, 1, 20, 7, 0, 0).valueOf().toString(),
    ],
    [
      actors.airline2,
      "US 102: NIG-BCDEA",
      new Date(2021, 2, 20, 8, 0, 0).valueOf().toString(),
    ],
    [
      actors.airline3,
      "DU 103: NIG-CDEAB",
      new Date(2021, 3, 20, 9, 0, 0).valueOf().toString(),
    ],
    [
      actors.airline4,
      "MU 104: NIG-DEABC",
      new Date(2021, 4, 20, 10, 0, 0).valueOf().toString(),
    ],
    [
      actors.airline5,
      "BE 105: NIG-EABCD",
      new Date(2021, 5, 20, 11, 0, 0).valueOf().toString(),
    ],
  ];

  passengers = accounts.slice(1, 5);
  airlines = accounts.slice(5, 10);
  oracles = accounts.slice(20, 20 + TEST_ORACLES_COUNT);

  let flightSuretyData = await FlightSuretyData.deployed();
  let flightSuretyApp = await FlightSuretyApp.deployed();

  return {
    contractOwner: actors.contractOwner,
    actors: actors,
    airlines: airlines,
    passengers: passengers,
    flights: flights,
    oracles: oracles,
    flightSuretyData: flightSuretyData,
    flightSuretyApp: flightSuretyApp,
  };
};

module.exports = {
  Config: Config,
};
