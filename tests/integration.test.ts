import { describe, it, expect, beforeEach, afterEach } from "vitest";
import Hapi from "@hapi/hapi";
import AuthenticationRouter from "../src/routes/auth/authentication-routes";
import TransactionRouter from "../src/routes/transaction/transaction-route";
import { DatabaseConnection } from "../src/utils/db-connection";

describe("Digital Wallet POC Integration Tests", () => {
	let server: Hapi.Server;
	let dbConn: any;

	beforeEach(async () => {
		// Setup server
		server = Hapi.server({
			port: 3000,
			host: "localhost",
		});

		await server.register([
			{
				plugin: AuthenticationRouter,
				routes: { prefix: "/hapi/authentication" },
			},
			{
				plugin: TransactionRouter,
				routes: { prefix: "/hapi/transaction" },
			},
		]);

		server.ext("onPreResponse", (request, h) => {
			const response = request.response;

			if (response && typeof response === "object" && "isBoom" in response && response.isBoom) {
				return h.response({
					success: false,
					statusCode: (response as any).output.statusCode,
					message: (response as any).output.payload.message,
				}).code((response as any).output.statusCode);
			}

			return h.continue;
		});

		// Get database connection
		dbConn = await DatabaseConnection.connect();

		// Clean up test data
		await dbConn.query("DELETE FROM transactions");
		await dbConn.query("DELETE FROM wallets");
		await dbConn.query("DELETE FROM users");
	});

	afterEach(async () => {
		// Cleanup
		try {
			await dbConn.query("DELETE FROM transactions");
			await dbConn.query("DELETE FROM wallets");
			await dbConn.query("DELETE FROM users");
		} catch (error) {
			console.error("Error during cleanup:", error);
		} finally {
			dbConn?.release();
			await server.stop();
		}
	});

	describe("POST /hapi/authentication/registration - Integration Tests", () => {
		it("should successfully register a new user with valid credentials", async () => {
			const payload = {
				username: "testuser123",
				password: "password123",
				mobileNumber: "09170000001",
			};

			const res = await server.inject({
				method: "POST",
				url: "/hapi/authentication/registration",
				payload,
			});

			expect(res.statusCode).toBe(201);
			const body = JSON.parse(res.payload);
			expect(body).toHaveProperty("message", "User registered successfully");

			// Verify user was actually saved to database
			const userResult = await dbConn.query(
				"SELECT * FROM users WHERE username = $1",
				["testuser123"]
			);
			expect(userResult.rows.length).toBe(1);
			expect(userResult.rows[0].username).toBe("testuser123");

			// Verify wallet was created
			const walletResult = await dbConn.query(
				"SELECT * FROM wallets WHERE user_id = $1",
				[userResult.rows[0].id]
			);
			expect(walletResult.rows.length).toBe(1);
			expect(walletResult.rows[0].balance).toBe("1000.00");
		});

		it("should hash password during registration", async () => {
			const payload = {
				username: "hashtest",
				password: "password123",
				mobileNumber: "09170000002",
			};

			const res = await server.inject({
				method: "POST",
				url: "/hapi/authentication/registration",
				payload,
			});

			expect(res.statusCode).toBe(201);

			// Verify password was hashed (not plaintext)
			const userResult = await dbConn.query(
				"SELECT password FROM users WHERE username = $1",
				["hashtest"]
			);
			expect(userResult.rows[0].password).not.toBe("password123");
			expect(userResult.rows[0].password).toContain("$argon2");
		});

		it("should fail when user with mobile number already exists", async () => {
			const payload1 = {
				username: "user1",
				password: "password123",
				mobileNumber: "09170000003",
			};

			// First registration
			const res1 = await server.inject({
				method: "POST",
				url: "/hapi/authentication/registration",
				payload: payload1,
			});
			expect(res1.statusCode).toBe(201);

			// Try to register with same mobile number
			const payload2 = {
				username: "user2",
				password: "password123",
				mobileNumber: "09170000003",
			};

			const res2 = await server.inject({
				method: "POST",
				url: "/hapi/authentication/registration",
				payload: payload2,
			});

			expect(res2.statusCode).toBe(400);
			const body = JSON.parse(res2.payload);
			expect(body.message).toBe("User with this mobile number already exists.");
		});
	});

	describe("POST /hapi/authentication/login - Integration Tests", () => {
		beforeEach(async () => {
			// Register a test user before login tests
			await server.inject({
				method: "POST",
				url: "/hapi/authentication/registration",
				payload: {
					username: "loginuser",
					password: "password123",
					mobileNumber: "09170000010",
				},
			});
		});

		it("should successfully login with valid username and password", async () => {
			const payload = {
				username: "loginuser",
				password: "password123",
			};

			const res = await server.inject({
				method: "POST",
				url: "/hapi/authentication/login",
				payload,
			});

			expect(res.statusCode).toBe(200);
			const body = JSON.parse(res.payload);
			expect(body.message).toBe("User logged in successfully");
			expect(body.data).toHaveProperty("username", "loginuser");
			expect(body.data).toHaveProperty("wallet");
			expect(body.data.wallet).toHaveProperty("balance", "1000.00");
		});

		it("should successfully login with valid mobile number and password", async () => {
			const payload = {
				mobileNumber: "09170000010",
				password: "password123",
			};

			const res = await server.inject({
				method: "POST",
				url: "/hapi/authentication/login",
				payload,
			});

			expect(res.statusCode).toBe(200);
			const body = JSON.parse(res.payload);
			expect(body.message).toBe("User logged in successfully");
			expect(body.data).toHaveProperty("wallet");
		});

		it("should fail when password is incorrect", async () => {
			const payload = {
				username: "loginuser",
				password: "wrongpassword",
			};

			const res = await server.inject({
				method: "POST",
				url: "/hapi/authentication/login",
				payload,
			});

			expect(res.statusCode).toBe(401);
			const body = JSON.parse(res.payload);
			expect(body.message).toBe("Invalid password.");
		});

		it("should fail when user does not exist", async () => {
			const payload = {
				username: "nonexistent",
				password: "password123",
			};

			const res = await server.inject({
				method: "POST",
				url: "/hapi/authentication/login",
				payload,
			});

			expect(res.statusCode).toBe(404);
			const body = JSON.parse(res.payload);
			expect(body.message).toBe("User with this mobile number/ID does not exist.");
		});
	});

	describe("POST /hapi/transaction/transfer - Integration Tests", () => {
		let sender: any;
		let receiver: any;

		beforeEach(async () => {
			// Create sender user
			const senderRes = await server.inject({
				method: "POST",
				url: "/hapi/authentication/registration",
				payload: {
					username: "sender",
					password: "password123",
					mobileNumber: "09170000020",
				},
			});
			expect(senderRes.statusCode).toBe(201);

			// Create receiver user
			const receiverRes = await server.inject({
				method: "POST",
				url: "/hapi/authentication/registration",
				payload: {
					username: "receiver",
					password: "password123",
					mobileNumber: "09170000021",
				},
			});
			expect(receiverRes.statusCode).toBe(201);

			// Get wallet IDs from database
			const senderWallet = await dbConn.query(
				"SELECT w.id, w.balance FROM wallets w JOIN users u ON u.id = w.user_id WHERE u.username = $1",
				["sender"]
			);
			const receiverWallet = await dbConn.query(
				"SELECT w.id, w.balance FROM wallets w JOIN users u ON u.id = w.user_id WHERE u.username = $1",
				["receiver"]
			);

			sender = senderWallet.rows[0];
			receiver = receiverWallet.rows[0];
		});

		it("should successfully transfer money between two wallets", async () => {
			const payload = {
				senderWalletId: sender.id,
				receiverWalletId: receiver.id,
				amount: 100,
			};

			const res = await server.inject({
				method: "POST",
				url: "/hapi/transaction/transfer",
				payload,
			});

			expect(res.statusCode).toBe(201);
			const body = JSON.parse(res.payload);
			expect(body.message).toBe("Transfer completed successfully");
			expect(body.data).toHaveProperty("senderResult");
			expect(body.data).toHaveProperty("receiverResult");

			// Verify balances were updated
			const senderUpdated = await dbConn.query(
				"SELECT balance FROM wallets WHERE id = $1",
				[sender.id]
			);
			const receiverUpdated = await dbConn.query(
				"SELECT balance FROM wallets WHERE id = $1",
				[receiver.id]
			);

			expect(senderUpdated.rows[0].balance).toBe("900.00"); // 1000 - 100
			expect(receiverUpdated.rows[0].balance).toBe("1100.00"); // 1000 + 100
		});

		it("should fail when sender has insufficient balance", async () => {
			const payload = {
				senderWalletId: sender.id,
				receiverWalletId: receiver.id,
				amount: 5000, // More than 1000
			};

			const res = await server.inject({
				method: "POST",
				url: "/hapi/transaction/transfer",
				payload,
			});

			expect(res.statusCode).toBe(422);
			const body = JSON.parse(res.payload);
			expect(body.message).toBe("Insufficient funds.");

			// Verify balances were NOT changed
			const senderUpdated = await dbConn.query(
				"SELECT balance FROM wallets WHERE id = $1",
				[sender.id]
			);
			expect(senderUpdated.rows[0].balance).toBe("1000.00");
		});

		it("should fail when sender wallet does not exist", async () => {
			const payload = {
				senderWalletId: 99999,
				receiverWalletId: receiver.id,
				amount: 100,
			};

			const res = await server.inject({
				method: "POST",
				url: "/hapi/transaction/transfer",
				payload,
			});

			expect(res.statusCode).toBe(500);
		});

		it("should fail when receiver wallet does not exist", async () => {
			const payload = {
				senderWalletId: sender.id,
				receiverWalletId: 99999,
				amount: 100,
			};

			const res = await server.inject({
				method: "POST",
				url: "/hapi/transaction/transfer",
				payload,
			});

			expect(res.statusCode).toBe(500);
		});

		it("should handle multiple consecutive transfers", async () => {
			// First transfer
			const res1 = await server.inject({
				method: "POST",
				url: "/hapi/transaction/transfer",
				payload: {
					senderWalletId: sender.id,
					receiverWalletId: receiver.id,
					amount: 200,
				},
			});
			expect(res1.statusCode).toBe(201);

			// Second transfer
			const res2 = await server.inject({
				method: "POST",
				url: "/hapi/transaction/transfer",
				payload: {
					senderWalletId: sender.id,
					receiverWalletId: receiver.id,
					amount: 300,
				},
			});
			expect(res2.statusCode).toBe(201);

			// Verify final balances
			const senderFinal = await dbConn.query(
				"SELECT balance FROM wallets WHERE id = $1",
				[sender.id]
			);
			const receiverFinal = await dbConn.query(
				"SELECT balance FROM wallets WHERE id = $1",
				[receiver.id]
			);

			expect(senderFinal.rows[0].balance).toBe("500.00"); // 1000 - 200 - 300
			expect(receiverFinal.rows[0].balance).toBe("1500.00"); // 1000 + 200 + 300

			// Verify transactions were recorded
			const transactions = await dbConn.query(
				"SELECT * FROM transactions WHERE sender_wallet_id = $1 ORDER BY created_at",
				[sender.id]
			);
			expect(transactions.rows.length).toBe(2);
		});
	});
});
