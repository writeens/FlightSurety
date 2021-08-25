import DOM from "./dom";
import Contract from "./contract";
import "./flightsurety.css";

const populateSelectList = (idOfSelect, list) => {
  for (const entry of list) {
    var el = document.createElement("option");
    el.textContent = entry;
    el.value = entry;
    idOfSelect.appendChild(el);
  }
};

const fetchRegisteredAirlines = async (contract) => {
  let registeredAirlines = [];

  const isAirlineRegistered = (airline) =>
    new Promise((resolve, reject) => {
      contract.isAirlineRegistered(airline, (error, result) => {
        resolve(result);
      });
    });

  for (let airline of contract.airlines) {
    let isRegistered = await isAirlineRegistered(airline);
    if (isRegistered) {
      registeredAirlines.push(airline);
    }
  }
  return registeredAirlines;
};
const fetchRegisteredFlights = async (contract, flights) => {
  let registeredFlights = [];

  const isFlightRegistered = (flightName, airlineAccount, timestamp) =>
    new Promise((resolve, reject) => {
      contract.isFlightRegistered(
        airlineAccount,
        flightName,
        timestamp,
        (error, result) => {
          resolve(result);
        }
      );
    });

  for (const [flightName, [timestamp, airlineAccount]] of Object.entries(
    flights
  )) {
    // console.log(flightName, airlineAccount, timestamp); //357
    let isRegistered = await isFlightRegistered(
      flightName,
      airlineAccount,
      timestamp
    );
    if (isRegistered) {
      registeredFlights.push(flightName);
    }
  }
  return registeredFlights;
};

const handleRegisterAirline = async (contract) => {
  const selectedAirline =
    availableAirlines.options[availableAirlines.selectedIndex].value;
  const caller = allAccounts.options[allAccounts.selectedIndex].value;

  await nominateAccount(contract, caller, selectedAirline);

  contract.registerAirline(
    selectedAirline,
    caller,
    "British Airways",
    (err, result) => {
      console.log(err);
      console.log(result);
      if (result) {
        displayRegisterAirline.textContent = `Airline was nominated and resgistered by ${caller.slice(
          0,
          5
        )}...${caller.slice(-6)}. The txId is ${result}`;
      }
    }
  );
};

const handleRegisterFlight = async (contract, flights) => {
  const selectedFlight = `${flightList.options[flightList.selectedIndex].value}`
    .split("Airline")[0]
    .trim();

  const airlineAccount = flights[selectedFlight][1];
  const flightName = selectedFlight;
  const timestamp = flights[selectedFlight][0];

  contract.registerFlight(
    airlineAccount,
    flightName,
    timestamp,
    (err, result) => {
      console.log(err);
      console.log(result);
      if (result) {
        displayRegisterFlight.textContent = `Flight has been registered by airline ${airlineAccount.slice(
          0,
          5
        )}...${airlineAccount.slice(-6)}. The txId is ${result}`;
      }
    }
  );
};

const handleRequestFlightUpdate = async (contract, flights) => {
  const selectedFlight = `${
    registeredFlights.options[registeredFlights.selectedIndex].value
  }`;

  const airlineAccount = flights[selectedFlight][1];
  const flightName = selectedFlight;
  const timestamp = flights[selectedFlight][0];

  contract.fetchFlightStatus(
    airlineAccount,
    flightName,
    timestamp,
    (error, result, payload) => {
      statusFlightName.textContent = payload.flight;
      statusFlightAccount.textContent = payload.airlineAccount;
      statusFlightTimestamp.textContent = payload.timestamp;
    }
  );
};

//BUY INSURANCE
const handleBuyInsurance = (contract, flights) => {
  const passenger = passengerList.options[passengerList.selectedIndex].value;
  const selectedFlight =
    registeredFlights.options[registeredFlights.selectedIndex].value;
  const airlineAccount = flights[selectedFlight][1];
  const timestamp = flights[selectedFlight][0];

  contract.buyInsurance(
    passenger,
    airlineAccount,
    selectedFlight,
    timestamp,
    (error, result) => {
      console.log(error);
      console.log(result);
      if (result) {
        displayInsurance.textContent = `Insurance purchased by passenger ${passenger.slice(
          0,
          5
        )}...${passenger.slice(-6)}. The txId is ${result}`;
      }
    }
  );
};

// FUND ACCOUNTS
const fundAccount = async (contract, account) =>
  new Promise((resolve, reject) => {
    contract.fundAirline(account, (err, result) => {
      if (err) {
        reject(err);
        return;
      }
      resolve(result);
    });
  });

// NOMINATE ACCOUNTS
const nominateAccount = async (contract, fromAccount, account) =>
  new Promise((resolve, reject) => {
    contract.nominateAirline(account, fromAccount, (err, result) => {
      if (err) {
        reject(err);
        return;
      }
      resolve(result);
    });
  });

const main = async () => {
  let contract = new Contract("localhost", async () => {
    const date = 1629882753836;
    //HANDLE FLIGHT LIST
    const FLIGHTS = {
      "NG:NIG-100": [date + 1001, contract.airlines[0]],
      "NG:NIG-101": [date + 2001, contract.airlines[1]],
      "NG:NIG-102": [date + 3058, contract.airlines[2]],
      "NG:NIG-103": [date + 4058, contract.airlines[3]],
      "NG:NIG-104": [date + 5029, contract.airlines[4]],
    };

    //CHECK IF CONTRACT IS OPERATIONAL
    contract.isOperational((error, result) => {
      operational.textContent = result;
    });

    // UPDATE REGISTERED AIRLINE BOX
    const regAirlines = await fetchRegisteredAirlines(contract);
    // UPDATE REGISTERED FLIGHT BOX
    const regFlights = await fetchRegisteredFlights(contract, FLIGHTS);
    populateSelectList(registeredFlights, regFlights);

    //FUND REGISTERED AIRLINE ACCOUNTS
    for (let airline of regAirlines) {
      await fundAccount(contract, airline);
    }
    // registeredAirlines.textContent = regAirlines.join(",");
    populateSelectList(registeredAirlines, regAirlines);

    //POPULATE AIRLINES AVAILABLE FOR REGISTRATION
    const availAirlines = contract.airlines.filter(
      (airline) => !regAirlines.includes(airline)
    );
    populateSelectList(availableAirlines, availAirlines);
    populateSelectList(allAccounts, contract.airlines);

    //HANDLE REGISTER
    registerAirline.addEventListener("click", (e) =>
      handleRegisterAirline(contract)
    );

    const flightText = Object.entries(FLIGHTS)
      .filter((entry) => {
        const key = entry[0];
        return !regFlights.includes(key);
      })
      .map((entry) => {
        const airline = entry[1][1];
        const key = entry[0];
        return `${key} Airline: ${airline.slice(0, 5)}...${airline.slice(-6)}`;
      });

    populateSelectList(flightList, flightText);

    //HANDLE REGISTER FLIGHT
    registerFlight.addEventListener("click", (e) =>
      handleRegisterFlight(contract, FLIGHTS)
    );

    //HANDLE REQUEST FLIGHT STATUS UPDATE
    requestFlightStatusUpdate.addEventListener("click", () => {
      handleRequestFlightUpdate(contract, FLIGHTS);
    });

    populateSelectList(passengerList, contract.passengers);

    //HANDLE BUY INSURANCE
    buyInsurance.addEventListener("click", () => {
      handleBuyInsurance(contract, FLIGHTS);
    });

    const text =
      registeredFlights.options[registeredFlights.selectedIndex].value || "";
    buyInsurance.textContent = text
      ? `Buy Insurance for ${text}`
      : "Buy Insurance";

    //HANDLE USER SELECTS ITEM
    registeredFlights.addEventListener("change", () => {
      const val =
        registeredFlights.options[registeredFlights.selectedIndex].value;
      buyInsurance.textContent = `Buy Insurance for ${val}`;
    });
  });
};

main();
