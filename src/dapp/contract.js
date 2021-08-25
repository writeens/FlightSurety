import FlightSuretyApp from "../../build/contracts/FlightSuretyApp.json";
import Config from "./config.json";
import Web3 from "web3";

export default class Contract {
  constructor(network, callback) {
    let config = Config[network];
    this.web3 = new Web3(new Web3.providers.HttpProvider(config.url));
    this.flightSuretyApp = new this.web3.eth.Contract(
      FlightSuretyApp.abi,
      config.appAddress
    );
    this.initialize(callback);
    this.owner = null;
    this.airlines = [];
    this.passengers = [];
  }

  initialize(callback) {
    this.web3.eth.getAccounts((error, accts) => {
      this.owner = accts[0];

      let counter = 1;

      while (this.passengers.length < 4) {
        this.passengers.push(accts[counter++]);
      }

      while (this.airlines.length < 5) {
        this.airlines.push(accts[counter++]);
      }

      callback();
    });
  }

  isOperational(callback) {
    let self = this;
    self.flightSuretyApp.methods
      .isOperational()
      .call({ from: self.owner }, callback);
  }

  isAirlineFunded(airlineAccount, callback) {
    let self = this;
    self.flightSuretyData.methods.isAirlineFunded(airlineAccount).call(
      {
        from: self.owner,
      },
      callback
    );
  }

  fundAirline(airlineAccount, callback) {
    let self = this;
    self.flightSuretyApp.methods.fundAirline().send(
      {
        from: airlineAccount,
        value: this.web3.utils.toWei("10", "ether"),
        gas: 4000000,
        gasPrice: 100000000000,
      },
      callback
    );
  }

  nominateAirline(airlineAccount, fromAccount, callback) {
    let self = this;
    self.flightSuretyApp.methods.nominateAirline(airlineAccount).send(
      {
        from: fromAccount,
        gas: 4000000,
        gasPrice: 100000000000,
      },
      callback
    );
  }

  registerAirline(airlineAccount, fromAccount, airlineName, callback) {
    let self = this;
    self.flightSuretyApp.methods
      .registerAirline(airlineAccount, airlineName)
      .send(
        {
          from: fromAccount,
          gas: 4000000,
          gasPrice: 100000000000,
        },
        callback
      );
  }

  isAirlineRegistered(airlineAccount, callback) {
    let self = this;
    self.flightSuretyApp.methods.isAirlineRegistered(airlineAccount).call(
      {
        from: self.owner,
      },
      callback
    );
  }

  isFlightRegistered(airlineAccount, flight, timestamp, callback) {
    let self = this;
    self.flightSuretyApp.methods
      .isFlightRegistered(airlineAccount, flight, timestamp)
      .call(
        {
          from: self.owner,
        },
        callback
      );
  }

  registerFlight(airlineAccount, airlineName, timestamp, callback) {
    let self = this;
    self.flightSuretyApp.methods.registerFlight(airlineName, timestamp).send(
      {
        from: airlineAccount,
        gas: 4000000,
        gasPrice: 100000000000,
      },
      callback
    );
  }

  fetchFlightStatus(airlineAccount, flight, timestamp, callback) {
    let self = this;
    self.flightSuretyApp.methods
      .fetchFlightStatus(airlineAccount, flight, timestamp)
      .send(
        { from: self.owner, gas: 4000000, gasPrice: 100000000000 },
        (error, result) => {
          callback(error, result, { airlineAccount, flight, timestamp });
        }
      );
  }

  buyInsurance(passengerAccount, airlineAccount, flight, timestamp, callback) {
    let self = this;
    self.flightSuretyApp.methods
      .buyFlightInsurance(airlineAccount, flight, timestamp)
      .send(
        {
          from: passengerAccount,
          value: this.web3.utils.toWei("1", "ether"),
          gas: 4000000,
          gasPrice: 100000000000,
        },
        callback
      );
  }

  async accountBalance(account) {
    let balance = await this.web3.eth.getBalance(account);
    return await this.web3.utils.fromWei(balance);
  }

  pay(passengerAccount, airlineAccount, airlineName, timestamp, callback) {
    let self = this;
    self.flightSuretyApp.methods.withdrawBalance().send(
      {
        from: passengerAccount,
      },
      callback
    );
  }
}
