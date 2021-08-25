var HDWalletProvider = require("truffle-hdwallet-provider");
var mnemonic =
  "candy maple cake sugar pudding cream honey rich smooth crumble sweet treat";

module.exports = {
  networks: {
    development: {
      //FOR WORKING WITH GANACHE
      host: "127.0.0.1",
      port: 7545,
      network_id: "*",
      gas: 4612388,
    },
    // developmentOld: {
    //   //FOR POSSIBLE DEPLOYMENT ON ETHEREUM NETWORK
    //   provider: function () {
    //     return new HDWalletProvider(mnemonic, "http://127.0.0.1:7545/", 0, 50);
    //   },
    //   network_id: "*",
    //   gas: 4612388,
    // },
  },
  compilers: {
    solc: {
      version: "^0.5.0",
    },
  },
};
