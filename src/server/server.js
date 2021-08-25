import FlightSuretyApp from "../../build/contracts/FlightSuretyApp.json";
import Config from "./config.json";
import Web3 from "web3";
import express from "express";
import "regenerator-runtime/runtime";

let config = Config["localhost"];
let web3 = new Web3(
  new Web3.providers.WebsocketProvider(config.url.replace("http", "ws"))
);
web3.eth.defaultAccount = web3.eth.accounts[0];
let flightSuretyApp = new web3.eth.Contract(
  FlightSuretyApp.abi,
  config.appAddress
);

let oracles = [];
var ORACLES_COUNT = 10,
  FIRST_ORACLE_ADDRESS = 10,
  LAST_ORACLE_ADDRESS = 20;

const fetchOracleRegistrationFee = async (accounts) => {
  const fee = await flightSuretyApp.methods.REGISTRATION_FEE().call({
    from: accounts[0],
    gas: 5000000,
    gasPrice: 100000000000,
  });
  console.log(
    "Smart Contract requires (" + fee + ") wei to fund oracle registration."
  );
  return fee;
};

const registerOracles = async (accounts, fee) => {
  try {
    for (const account of accounts) {
      console.log("Register Oracle: " + account);

      const result = await flightSuretyApp.methods.registerOracle().send({
        from: account,
        value: fee,
        gas: 5000000,
        gasPrice: 100000000000,
      });
      console.log(`Registered:   ${account}`);
    }
    return { status: "ok" };
  } catch (e) {
    console.log("Unable to register oracle");
    console.log(e);
    return { status: "error" };
  }
};

const fetchOracleIndexes = async (oracles) => {
  const indexes = [];
  for (const oracle of oracles) {
    try {
      const result = await flightSuretyApp.methods.getMyIndexes().call({
        from: oracle,
        gas: 5000000,
        gasPrice: 100000000000,
      });

      indexes.push(result);

      console.log(`Assigned Indices: ${result[0]}, ${result[1]}, ${result[2]}`);
    } catch (e) {
      console.log("Could not retrieve oracle indices because: " + e);
    }
  }
  return indexes;
};

const handleOracleRequest = async (error, event) => {
  if (error) console.log(error);
  let eventResult = event["returnValues"];
  let index = eventResult["index"];
  let airline = eventResult["airline"];
  let flight = eventResult["flight"];
  let timestamp = eventResult["departureTime"];
  console.log(
    `Only the oracles with index ${index} should respond to the request`
  );

  //Query the oracles with matching index for the flight status
  for (oracle of oracles) {
    try {
      const indexes = await flightSuretyApp.methods.getMyIndexes().call({
        from: oracle,
        gas: 5000000,
        gasPrice: 100000000000,
      });
      if (result[0] == index || result[1] == index || result[2] == index) {
        let flightStatus = 20; // for testing only
        console.log(
          "HIT- Responding with random flight status: " +
            flightStatus +
            " from oracle: " +
            oracle
        );
      }
    } catch (e) {
      console.log("Unable to get indices");
    }
    try {
      const result = await flightSuretyApp.methods
        .submitOracleResponse(index, airline, flight, timestamp, flightStatus)
        .send({
          from: oracle,
          gas: 5000000,
          gasPrice: 100000000000,
        });
    } catch (e) {
      console.log("unable to submit oracle response");
    }
  }
};

web3.eth.getAccounts().then(async (accounts) => {
  if (accounts.length < ORACLES_COUNT) {
    console.log("Server Error - Not enough account to support oracles");
    return;
  }
  console.log("Ganache returned " + accounts.length + " accounts.");
  console.log(
    "Server will use only " + ORACLES_COUNT + " of these accounts for oracles."
  );
  console.log(
    "Starting from accounts[" + FIRST_ORACLE_ADDRESS + "] for the first oracle."
  );
  console.log(
    "Ending at account[" + LAST_ORACLE_ADDRESS + "] for the last oracle."
  );

  const ORACLE_REG_FEE = await fetchOracleRegistrationFee(accounts);
  oracles = accounts.filter(
    (account, index) =>
      index >= FIRST_ORACLE_ADDRESS && index < LAST_ORACLE_ADDRESS
  );
  const response = await registerOracles(oracles, ORACLE_REG_FEE);
  if (response.status !== "ok") {
    console.log("an error occurred");
  }

  const indexes = await fetchOracleIndexes(oracles);
});

flightSuretyApp.events.OracleRequest(
  { fromBlock: "latest" },
  handleOracleRequest()
);

const app = express();
app.get("/api", (req, res) => {
  res.send({
    message: "An API for use with your Dapp!",
  });
});

export default app;
