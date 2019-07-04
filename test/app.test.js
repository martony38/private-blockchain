const request = require("supertest");
const bitcoinMessage = require("bitcoinjs-message");
const bitcoin = require("bitcoinjs-lib");
const app = require("../app.js");

const wallet = "5KYZdUEo39z3FPrtuX2QbbwGnNP5zTd7yyr2SC1j299sBCnWjss";
const keyPair = bitcoin.ECPair.fromWIF(wallet);
const { address } = bitcoin.payments.p2pkh({ pubkey: keyPair.publicKey });
let message, genesisBlockHash;
const star = { dec: "dec", ra: "ra", story: "story" };

test("GET /block/0 should return the genesis block", async () => {
  const response = await request(app).get("/block/0");
  const { body, statusCode } = response;
  expect(statusCode).toBe(200);
  expect(body).toHaveProperty("hash");
  expect(/^[a-fA-F0-9]{64}$/.test(body.hash)).toBe(true);
  genesisBlockHash = body.hash;
  expect(body).toHaveProperty("height", 0);
  expect(body).toHaveProperty(
    "body",
    "7b2264617461223a2247656e6573697320426c6f636b227d"
  );
  expect(body).toHaveProperty("time");
  expect(body).toHaveProperty("previousBlockHash", null);
});

test("POST /requestValidation should return a formatted message", async () => {
  const response = await request(app)
    .post("/requestValidation")
    .send({ address });
  const { body, statusCode } = response;
  expect(statusCode).toBe(200);
  message = body;
  const formattedMessage = new RegExp(`^${address}:[0-9]{10}:starRegistry$`);
  expect(message).toMatch(formattedMessage);
});

test("POST /submitstar should return a block with the star encoded in the body", async () => {
  const privateKey = keyPair.privateKey;
  const signature = bitcoinMessage.sign(
    message,
    privateKey,
    keyPair.compressed
  );

  const response = await request(app)
    .post("/submitstar")
    .send({ address, message, signature, star });
  const { body, statusCode } = response;
  expect(statusCode).toBe(200);
  expect(body).toHaveProperty("hash");
  expect(/^[a-fA-F0-9]{64}$/.test(body.hash)).toBe(true);
  expect(body).toHaveProperty("height", 1);
  expect(body).toHaveProperty(
    "body",
    "7b2264617461223a7b226f776e6572223a2231485a776b6a6b65616f5a665453614a78447736614b6b7870343561674469457a4e222c2273746172223a7b22646563223a22646563222c227261223a227261222c2273746f7279223a2273746f7279227d7d7d"
  );
  expect(body).toHaveProperty("time");
  expect(body).toHaveProperty("previousBlockHash", genesisBlockHash);
});

test("GET /blocks/:address should return a list of stars owned by address", async () => {
  const response = await request(app).get(`/blocks/${address}`);
  const { body, statusCode } = response;
  expect(statusCode).toBe(200);
  expect(Array.isArray(body)).toBe(true);
  expect(body.length).toBe(1);
  expect(body[0]).toHaveProperty("owner");
  expect(body[0]).toHaveProperty("star");
  expect(body[0].owner).toBe(`${address}`);
  expect(body[0].star).toStrictEqual(star);
});
