var Test = require("../config/testConfig.js");
var BigNumber = require("bignumber.js");
const { expect } = require("chai");
const {
  expectEvent, // Assertions for emitted events
  expectRevert, // Assertions for transactions that should fail
  ether,
} = require("@openzeppelin/test-helpers");

contract("Flight Surety Tests", async (accounts) => {
  var config;
  before("setup contract", async () => {
    config = await Test.Config(accounts);
    data = config.flightSuretyData;
    app = config.flightSuretyApp;
    actors = config.actors;
    airlines = config.airlines;
    passengers = config.passengers;
    flights = config.flights;
    oracles = config.oracles;
    await data.authorizeCaller(app.address);
  });

  /****************************************************************************************/
  /* Operations and Settings                                                              */
  /****************************************************************************************/

  it(`(multiparty) has correct initial isOperational() value`, async function () {
    // Get operating status
    let status = await app.isOperational.call();
    assert.equal(status, true, "Incorrect initial operating status value");
  });

  it(`(multiparty) can block access to setOperatingStatus() for non-Contract Owner account`, async function () {
    // Ensure that access is denied for non-Contract Owner account
    let accessDenied = false;
    try {
      await app.setOperatingStatus(false, { from: accounts[1] });
    } catch (e) {
      accessDenied = true;
    }
    assert.equal(accessDenied, true, "Access not restricted to Contract Owner");
  });

  it(`(multiparty) can allow access to setOperatingStatus() for Contract Owner account`, async function () {
    // Ensure that access is allowed for Contract Owner account
    let accessDenied = false;
    try {
      await app.setOperatingStatus(false, { from: config.contractOwner });
    } catch (e) {
      accessDenied = true;
    }
    assert.equal(
      accessDenied,
      false,
      "Access not restricted to Contract Owner"
    );
  });

  it(`Can block access to functions using requireIsOperational when operating status is false`, async function () {
    await app.setOperatingStatus(false, { from: config.contractOwner });

    let reverted = false;
    try {
      await app.registerAirline(actors.airline2, { from: airline1 });
    } catch (e) {
      reverted = true;
    }
    assert.equal(reverted, true, "Access not blocked for requireIsOperational");

    // Set it back for other tests to work
    await app.setOperatingStatus(true, { from: config.contractOwner });
  });

  it("First airline is registered when contract is deployed.", async () => {
    let tx = false;
    let threwError = false;
    try {
      tx = await app.isAirlineRegistered(actors.airline1);
    } catch (error) {
      threwError = true;
    }
    assert.equal(tx, true, "First airline is not registered upon deployment");
    assert.equal(threwError, false, "Test threw an unexpected error");
  });

  describe("Airlines", () => {
    describe("Scenario: Only existing airline may register a new airline until there are at least four airlines registered", () => {
      before("Nominate airlines", async () => {
        let tx2 = await app.nominateAirline(actors.airline2, {
          from: actors.airline1,
        });
        expectEvent(tx2, "AppAirlineNominated", {
          airlineAddress: actors.airline2,
        });

        let tx3 = await app.nominateAirline(actors.airline3, {
          from: actors.airline1,
        });
        expectEvent(tx3, "AppAirlineNominated", {
          airlineAddress: actors.airline3,
        });

        let tx4 = await app.nominateAirline(actors.airline4, {
          from: actors.airline1,
        });
        expectEvent(tx4, "AppAirlineNominated", {
          airlineAddress: actors.airline4,
        });

        let tx5 = await app.nominateAirline(actors.airline5, {
          from: actors.airline1,
        });
        expectEvent(tx5, "AppAirlineNominated", {
          airlineAddress: actors.airline5,
        });
      });

      it("Unregistered airline cannot register a new airline", async () => {
        await expectRevert(
          app.registerAirline(actors.airline3, "Yellow Airline", {
            from: actors.airline2,
          }),
          "Airline is not funded"
        );
      });

      it("Airline can be registered, but it cannot participate in contract until it submits funding of 10 ether", async () => {
        await expectRevert(
          app.registerAirline(actors.airline2, "Red Airline", {
            from: actors.airline1,
          }),
          "Airline is not funded"
        );

        let fundingAmount = ether("10");

        let tx = await app.fundAirline({
          from: actors.airline1,
          value: fundingAmount,
        });

        expectEvent(tx, "AppAirlineFunded", {
          airlineAddress: actors.airline1,
          amount: fundingAmount,
        });

        let result = await app.getAirlineFunds(actors.airline1);
        expect(result).to.be.bignumber.equal(fundingAmount);
      });

      it("First airline registers the second airline.", async () => {
        let tx = await app.registerAirline(actors.airline2, "British Airways", {
          from: actors.airline1,
        });
        expectEvent(tx, "AppAirlineRegistered", {
          airlineAccount: actors.airline2,
          airlineName: "British Airways",
        });
      });

      it("First airline registers the third airline.", async () => {
        let tx = await app.registerAirline(actors.airline3, "Pacific Airways", {
          from: actors.airline1,
        });
        expectEvent(tx, "AppAirlineRegistered", {
          airlineAccount: actors.airline3,
          airlineName: "Pacific Airways",
        });
      });

      it("First airline registers the fourth airline.", async () => {
        let tx = await app.registerAirline(actors.airline4, "Winona Airways", {
          from: actors.airline1,
        });
        expectEvent(tx, "AppAirlineRegistered", {
          airlineAccount: actors.airline4,
          airlineName: "Winona Airways",
        });
      });
    });

    describe("Scenario:Registration of fifth and subsequent airlines requires multi-party consensus of 50% of registered airlines", () => {
      it("First airline tries to register the fifth airline. and fails", async () => {
        let tx = await app.registerAirline(actors.airline5, "Korra Airways", {
          from: actors.airline1,
        });
        expectEvent.notEmitted(tx, "AppAirlineRegistered");

        //GET NUMBER OF VOTES FOR THIS AIRLINE
        let votes = await app.getNumberAirlineVotes.call(actors.airline5);
        assert.equal(
          votes,
          1,
          "Expect only one vote has been cast for Airline #5"
        );
      });

      it("Upon reaching 50% threshold of votes of all registered airlines, registration is successful", async () => {
        let fundingAmount = ether("10");
        let tx0 = await app.fundAirline({
          from: actors.airline2,
          value: fundingAmount,
        });

        expectEvent(tx0, "AppAirlineFunded", {
          airlineAddress: actors.airline2,
          amount: fundingAmount,
        });

        let tx = await app.registerAirline(actors.airline5, "Korra Airways", {
          from: actors.airline2,
        });
        expectEvent(tx, "AppAirlineRegistered", {
          airlineAccount: actors.airline5,
          airlineName: "Korra Airways",
        });
        let votes = await app.getNumberAirlineVotes.call(actors.airline5);
        assert.equal(
          votes,
          2,
          "Expect two votes have been cast for Airline #5"
        );
      });

      it("Fund remaining airlines", async () => {
        let fundingAmount = ether("10");

        //FUND AIRLINE 3
        let tx3 = await app.fundAirline({
          from: actors.airline3,
          value: fundingAmount,
        });

        //FUND AIRLINE 4
        let tx4 = await app.fundAirline({
          from: actors.airline4,
          value: fundingAmount,
        });

        //FUND AIRLINE 5
        let tx5 = await app.fundAirline({
          from: actors.airline5,
          value: fundingAmount,
        });

        for (const airlineAddress of airlines) {
          let result = await data.isAirlineFunded(airlineAddress);
          assert.equal(result, true);
        }
      });
    });
  });

  describe("Passengers", () => {
    describe("Scenario: Airline registers flights and passengers can purchase up to 1 ether ", () => {
      it("Each airline registers a flight", async () => {
        for (const flight of flights) {
          let flightAirline = flight[0];
          let flightName = flight[1];
          let timestamp = flight[2];

          let tx = await app.registerFlight(flightName, timestamp, {
            from: flightAirline,
          });
          expectEvent(tx, "AppFlightRegistered", {
            caller: flightAirline,
            flight: flightName,
          });

          let registrationStatus = await app.isFlightRegistered(
            flightAirline,
            flightName,
            timestamp
          );
          assert.equal(registrationStatus, true, "Flight is not registered");
        }
      });

      it("Passengers can purchase flight insurance on a flight for up to 1 ether", async () => {
        let insuranceAmount = ether("1");

        passengers.forEach(async (passengerAddress, index) => {
          let flight = flights[index];
          let flightAirline = flight[0];
          let flightName = flight[1];
          let departureTime = flight[2];

          let tx = await app.buyFlightInsurance(
            flightAirline,
            flightName,
            departureTime,
            { from: passengerAddress, value: insuranceAmount }
          );
          expectEvent(tx, "AppInsurancePurchased", {
            passengerAccount: passengerAddress,
            amount: insuranceAmount,
            airlineAccount: flightAirline,
          });
        });
      });
    });
  });
});
