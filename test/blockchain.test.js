const BlockchainClass = require("../src/blockchain.js");
const BlockClass = require("../src/block.js");
const bitcoinMessage = require("bitcoinjs-message");
const bitcoin = require("bitcoinjs-lib");
const hex2ascii = require("hex2ascii");
const util = require("util");

let blockchain;
beforeEach(() => {
  blockchain = new BlockchainClass.Blockchain();
});

test("constructor assigns correct properties and initialize the chain", () => {
  expect(Array.isArray(blockchain.chain)).toBe(true);
  expect(blockchain.chain.length).toBe(1);
  expect(blockchain.height).toBe(0);
});

describe("method initializeChain", () => {
  test("calls private method _addBlock if genesis block has NOT been created yet", async () => {
    blockchain.height = -1;
    blockchain._addBlock = jest.fn();
    await blockchain.initializeChain();
    expect(blockchain._addBlock.mock.calls.length).toBe(1);
    expect(blockchain._addBlock.mock.calls[0][0]).toBeInstanceOf(
      BlockClass.Block
    );
    expect(blockchain._addBlock.mock.calls[0][0].body).toBe(
      Buffer.from(JSON.stringify({ data: "Genesis Block" })).toString("hex")
    );
  });

  test("does not calls private method _addBlock if genesis block has been created", async () => {
    blockchain._addBlock = jest.fn();
    await blockchain.initializeChain();
    expect(blockchain._addBlock.mock.calls.length).toBe(0);
  });
});

describe("method getChainHeight", () => {
  test("returns a promise", async () => {
    await expect(blockchain.getChainHeight()).toBeInstanceOf(Promise);
  });

  test("returns the height of the chain", async () => {
    blockchain.height = 10;
    await expect(blockchain.getChainHeight()).resolves.toBe(10);
  });
});

describe("private method _addBlock", () => {
  test("returns a promise", async () => {
    await expect(blockchain._addBlock()).toBeInstanceOf(Promise);
  });

  test("returns a block", async () => {
    const block = new BlockClass.Block({ data: "test" });
    blockchain.getChainHeight = () => Promise.resolve(10);
    blockchain.getBlockByHeight = () => Promise.resolve({ hash: "1234" });
    await expect(blockchain._addBlock(block)).resolves.toBeInstanceOf(
      BlockClass.Block
    );
  });

  test("returns a block with the correct height and add it to the chain", async () => {
    const block = new BlockClass.Block({ data: "test" });
    blockchain.getChainHeight = () => Promise.resolve(3);
    blockchain.getBlockByHeight = () => Promise.resolve({ hash: "1234" });
    blockchain.chain.push({}, {}, {});
    await blockchain._addBlock(block);

    expect(block).toHaveProperty("height", 4);
    expect(block).toHaveProperty("previousBlockHash", "1234");
    expect(blockchain.chain).toContain(block);
    expect(blockchain.height).toBe(4);
  });

  test("rejects if previous block cannot be found", async () => {
    const block = new BlockClass.Block({ data: "test" });
    blockchain.getChainHeight = () => Promise.resolve(10);
    blockchain.getBlockByHeight = () => Promise.resolve(null);
    await expect(blockchain._addBlock(block)).rejects.toBeInstanceOf(Error);
    await expect(blockchain._addBlock(block)).rejects.toThrow(
      "Previous block cannot be found"
    );
  });
});

describe("method requestMessageOwnershipVerification", () => {
  test("returns a promise", async () => {
    await expect(
      blockchain.requestMessageOwnershipVerification("test")
    ).toBeInstanceOf(Promise);
  });

  test("returns the formatted message to be signed", async () => {
    await expect(
      blockchain.requestMessageOwnershipVerification("test")
    ).resolves.toMatch(/^test:[0-9]{10}:starRegistry$/);
  });
});

describe("method submitStar", () => {
  let address, message, signature, star, keyPair, privateKey;
  beforeEach(() => {
    keyPair = bitcoin.ECPair.fromWIF(
      "5KYZdUEo39z3FPrtuX2QbbwGnNP5zTd7yyr2SC1j299sBCnWjss"
    );
    privateKey = keyPair.privateKey;
    ({ address } = bitcoin.payments.p2pkh({ pubkey: keyPair.publicKey }));

    message = `${address}:${new Date()
      .getTime()
      .toString()
      .slice(0, -3)}:starRegistry`;

    signature = bitcoinMessage.sign(message, privateKey, keyPair.compressed);
    star = { dec: "dec", ra: "ra", story: "story" };
  });

  test("returns a promise", async () => {
    await expect(
      blockchain.submitStar(address, message, signature, star)
    ).toBeInstanceOf(Promise);
  });

  test("returns a block with the star in the body", async () => {
    const starBlock = await blockchain.submitStar(
      address,
      message,
      signature,
      star
    );
    expect(starBlock).toBeInstanceOf(BlockClass.Block);
    expect(JSON.parse(hex2ascii(starBlock.body))).toStrictEqual({
      data: {
        owner: address,
        star
      }
    });
  });

  test("rejects if time limit has passed", async () => {
    message = `${address}:1562026671:starRegistry`;
    signature = bitcoinMessage.sign(message, privateKey, keyPair.compressed);
    await expect(
      blockchain.submitStar(address, message, signature, star)
    ).rejects.toBeInstanceOf(Error);
    await expect(
      blockchain.submitStar(address, message, signature, star)
    ).rejects.toThrow("Ownership message is no longer valid");
  });

  test("rejects if signature is invalid", async () => {
    const badKeyPair = bitcoin.ECPair.fromWIF(
      "Kxr9tQED9H44gCmp6HAdmemAzU3n84H3dGkuWTKvE23JgHMW8gct"
    );
    const badPrivateKey = badKeyPair.privateKey;

    const badSignature = bitcoinMessage.sign(
      message,
      badPrivateKey,
      badKeyPair.compressed
    );
    await expect(
      blockchain.submitStar(address, message, badSignature, star)
    ).rejects.toBeInstanceOf(Error);
    await expect(
      blockchain.submitStar(address, message, badSignature, star)
    ).rejects.toThrow("Message signature is invalid");
  });

  test("rejects if an error occur while adding block", async () => {
    blockchain._addBlock = () => Promise.reject(new Error("error occured"));
    await expect(
      blockchain.submitStar(address, message, signature, star)
    ).rejects.toBeInstanceOf(Error);
    await expect(
      blockchain.submitStar(address, message, signature, star)
    ).rejects.toThrow("error occured");
  });
});

describe("method getBlockByHash", () => {
  test("returns a promise", async () => {
    await expect(blockchain.getBlockByHash("test")).toBeInstanceOf(Promise);
  });

  test("returns a block", async () => {
    const hash = blockchain.chain[0].hash;
    await expect(blockchain.getBlockByHash(hash)).resolves.toBeInstanceOf(
      BlockClass.Block
    );
    await expect(blockchain.getBlockByHeight(0)).resolves.toBe(
      blockchain.chain[0]
    );
  });

  test("rejects if cannot find block", async () => {
    const hash = "fake hash";
    await expect(blockchain.getBlockByHash(hash)).rejects.toBeInstanceOf(Error);
    await expect(blockchain.getBlockByHash(hash)).rejects.toThrow(
      "Could not find block with hash fake hash"
    );
  });
});

describe("method getBlockByHeight", () => {
  test("returns a promise", async () => {
    await expect(blockchain.getBlockByHeight(0)).toBeInstanceOf(Promise);
  });

  test("returns a block", async () => {
    await expect(blockchain.getBlockByHeight(0)).resolves.toBeInstanceOf(
      BlockClass.Block
    );
    await expect(blockchain.getBlockByHeight(0)).resolves.toBe(
      blockchain.chain[0]
    );
  });

  test("returns null if cannot find block", async () => {
    await expect(blockchain.getBlockByHeight(10)).resolves.toBe(null);
  });

  test("returns the correct height", async function() {
    blockchain.chain.push({ height: 1 }, { height: 2 }, { height: 3 });
    const block = await blockchain.getBlockByHeight(2);
    expect(block).toStrictEqual({ height: 2 });
  });
});

describe("method getStarsByWalletAddress", () => {
  test("returns a promise", async () => {
    await expect(blockchain.getStarsByWalletAddress("test")).toBeInstanceOf(
      Promise
    );
  });

  test("returns an empty list if there are no star owned by the wallet address", async () => {
    await expect(
      blockchain.getStarsByWalletAddress("test")
    ).resolves.toStrictEqual([]);
  });

  test("returns a list of stars owned by the wallet address", async () => {
    const keyPair = bitcoin.ECPair.fromWIF(
      "5KYZdUEo39z3FPrtuX2QbbwGnNP5zTd7yyr2SC1j299sBCnWjss"
    );
    const privateKey = keyPair.privateKey;
    const { address } = bitcoin.payments.p2pkh({ pubkey: keyPair.publicKey });

    const message = `${address}:${new Date()
      .getTime()
      .toString()
      .slice(0, -3)}:starRegistry`;
    const signature = bitcoinMessage.sign(
      message,
      privateKey,
      keyPair.compressed
    );
    const star1 = { dec: "dec1", ra: "ra1", story: "story1" };
    await blockchain.submitStar(address, message, signature, star1);

    const star2 = { dec: "dec2", ra: "ra2", story: "story2" };
    await blockchain.submitStar(address, message, signature, star2);

    await expect(
      blockchain.getStarsByWalletAddress(address)
    ).resolves.toStrictEqual([
      { owner: address, star: star1 },
      { owner: address, star: star2 }
    ]);
  });
});

describe("method validateChain", () => {
  let address, message, signature, star, keyPair, privateKey;
  beforeEach(() => {
    keyPair = bitcoin.ECPair.fromWIF(
      "5KYZdUEo39z3FPrtuX2QbbwGnNP5zTd7yyr2SC1j299sBCnWjss"
    );
    privateKey = keyPair.privateKey;
    ({ address } = bitcoin.payments.p2pkh({ pubkey: keyPair.publicKey }));

    message = `${address}:${new Date()
      .getTime()
      .toString()
      .slice(0, -3)}:starRegistry`;

    signature = bitcoinMessage.sign(message, privateKey, keyPair.compressed);
    star = { dec: "dec", ra: "ra", story: "story" };
  });

  test("returns a promise", async () => {
    await expect(blockchain.validateChain()).toBeInstanceOf(Promise);
  });

  test.only("resolves with an empty list if chain is valid", async () => {
    await blockchain.submitStar(address, message, signature, star);

    const star1 = { dec: "dec1", ra: "ra1", story: "story1" };
    await blockchain.submitStar(address, message, signature, star1);

    const star2 = { dec: "dec2", ra: "ra2", story: "story2" };
    await blockchain.submitStar(address, message, signature, star2);

    await expect(blockchain.validateChain()).resolves.toStrictEqual([]);
  });

  test("rejects with a list of errors if chain is not valid", async () => {
    blockchain.chain.push({});
    await expect(blockchain.validateChain()).rejects.toStrictEqual([]);
  });
});
