const BlockClass = require("../src/block.js");
const hex2ascii = require("hex2ascii");
const SHA256 = require("crypto-js/sha256");

let block;
let data;
beforeEach(() => {
  data = {
    owner: "owner",
    star: { dec: "dec", ra: "ra", story: "story" }
  };
  block = new BlockClass.Block({ data });
});

test("constructor assigns correct properties", () => {
  expect(block.hash).toEqual(null);
  expect(block.height).toEqual(0);
  expect(block.time).toEqual(0);
  expect(block.previousBlockHash).toEqual(null);

  expect(hex2ascii(block.body)).toEqual(JSON.stringify({ data }));
});

describe("method validate", () => {
  test("returns a promise", async () => {
    await expect(block.validate()).toBeInstanceOf(Promise);
  });

  test("returns true if block is valid", async () => {
    block.hash = SHA256(JSON.stringify(block)).toString();
    await expect(block.validate()).resolves.toBe(true);
  });

  test("returns false if block is not valid", async () => {
    await expect(block.validate()).resolves.toBe(false);
  });
});

describe("method getBData", () => {
  test("returns a promise", async () => {
    await expect(block.getBData()).toBeInstanceOf(Promise);
  });

  test("rejects if block is the genesis block", async () => {
    await expect(block.getBData()).rejects.toBeInstanceOf(Error);
    await expect(block.getBData()).rejects.toThrow(
      "genesis block do not contain data"
    );
  });

  test("rejects with an error if an error occur while parsing the data", async () => {
    block.height = 1;
    block.body = "[}{".toString();
    await expect(block.getBData()).rejects.toBeInstanceOf(Error);
    await expect(block.getBData()).rejects.toThrow(
      "Unexpected end of JSON input"
    );
  });

  test("resolves with the data", async () => {
    block.height = 1;
    await expect(block.getBData()).resolves.toStrictEqual(data);
  });
});
