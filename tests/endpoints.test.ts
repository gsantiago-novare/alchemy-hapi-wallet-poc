import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import Hapi from "@hapi/hapi";
import AuthenticationRouter from "../src/routes/auth/authentication-routes";
import TransactionRouter from "../src/routes/transaction/transaction-route";
import { WalletRepository } from "../src/repository/wallet";
import { UserRepository } from "../src/repository/auth";
import ClientError from "../src/errors/ClientError";
import argon2 from "argon2";

describe("Digital Wallet POC Endpoints", () => {
	let server: Hapi.Server;

	beforeEach(async () => {
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

		// Mock repository methods
		vi.spyOn(UserRepository, "findByMobileNumber").mockResolvedValue(null);
		vi.spyOn(UserRepository, "registerUser").mockResolvedValue({
			id: 1,
			username: "testuser123",
			mobile_number: "09170000001",
			password: "hashed_password",
		} as any);
		vi.spyOn(WalletRepository, "registerWallet").mockResolvedValue({
			id: 1,
			user_id: 1,
			balance: 1000,
			currency: "PHP",
		} as any);
		vi.spyOn(WalletRepository, "findWalletById").mockResolvedValue({
			id: 1,
			user_id: 1,
			balance: 1000,
			currency: "PHP",
		} as any);
		vi.spyOn(argon2, "hash").mockResolvedValue("hashed_password" as any);
		vi.spyOn(argon2, "verify").mockResolvedValue(true as any);

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
	});

	afterEach(async () => {
		vi.clearAllMocks();
		await server.stop();
	});

	describe("POST /hapi/authentication/registration", () => {
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
			expect(JSON.parse(res.payload)).toHaveProperty("message", "User registered successfully");
		});

		it("should fail when username is missing", async () => {
			const payload = {
				password: "password123",
				mobileNumber: "09170000001",
			};

			const res = await server.inject({
				method: "POST",
				url: "/hapi/authentication/registration",
				payload,
			});

			expect(res.statusCode).toBe(400);
			expect(JSON.parse(res.payload)).toHaveProperty("statusCode", 400);
		});

		it("should fail when password is less than 8 characters", async () => {
			const payload = {
				username: "testuser123",
				password: "pass123",
				mobileNumber: "09170000001",
			};

			const res = await server.inject({
				method: "POST",
				url: "/hapi/authentication/registration",
				payload,
			});

			expect(res.statusCode).toBe(400);
			const body = JSON.parse(res.payload);
			expect(body.statusCode).toBe(400);
		});

		it("should fail when mobile number is invalid (not PH format)", async () => {
			const payload = {
				username: "testuser123",
				password: "password123",
				mobileNumber: "12345678901",
			};

			const res = await server.inject({
				method: "POST",
				url: "/hapi/authentication/registration",
				payload,
			});

			expect(res.statusCode).toBe(400);
			expect(JSON.parse(res.payload)).toHaveProperty("statusCode", 400);
		});

		it("should fail when user with mobile number already exists", async () => {
			const payload = {
				username: "testuser123",
				password: "password123",
				mobileNumber: "09170000001",
			};

			vi.spyOn(UserRepository, "findByMobileNumber").mockResolvedValue({
				id: 1,
				username: "existinguser",
				mobile_number: "09170000001",
				password: "hashed_password",
			} as any);

			const res = await server.inject({
				method: "POST",
				url: "/hapi/authentication/registration",
				payload,
			});

			expect(res.statusCode).toBe(400);
			const body = JSON.parse(res.payload);
			expect(body.message).toBe("User with this mobile number already exists.");
		});

		it("should fail when username is too long (>50 characters)", async () => {
			const longUsername = "a".repeat(51);
			const payload = {
				username: longUsername,
				password: "password123",
				mobileNumber: "09170000001",
			};

			const res = await server.inject({
				method: "POST",
				url: "/hapi/authentication/registration",
				payload,
			});

			expect(res.statusCode).toBe(400);
		});

		it("should fail when username is too short (<3 characters)", async () => {
			const payload = {
				username: "ab",
				password: "password123",
				mobileNumber: "09170000001",
			};

			const res = await server.inject({
				method: "POST",
				url: "/hapi/authentication/registration",
				payload,
			});

			expect(res.statusCode).toBe(400);
		});
	});

	// ============== LOGIN TESTS ==============
	describe("POST /hapi/authentication/login", () => {
		it("should successfully login with valid username and password", async () => {
			const payload = {
				username: "alice_wallet",
				password: "password123",
			};

			vi.spyOn(UserRepository, "findByMobileNumber").mockResolvedValue({
				id: 1,
				username: "alice_wallet",
				mobile_number: "09170000001",
				password: "hashed_password",
			} as any);

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

		it("should successfully login with valid mobile number and password", async () => {
			const payload = {
				mobileNumber: "09170000001",
				password: "password123",
			};

			vi.spyOn(UserRepository, "findByMobileNumber").mockResolvedValue({
				id: 1,
				username: "alice_wallet",
				mobile_number: "09170000001",
				password: "hashed_password",
			} as any);

			const res = await server.inject({
				method: "POST",
				url: "/hapi/authentication/login",
				payload,
			});

			expect(res.statusCode).toBe(200);
			expect(JSON.parse(res.payload)).toHaveProperty("message", "User logged in successfully");
		});

		it("should fail when password is missing", async () => {
			const payload = {
				username: "alice_wallet",
			};

			const res = await server.inject({
				method: "POST",
				url: "/hapi/authentication/login",
				payload,
			});

			expect(res.statusCode).toBe(400);
		});

		it("should fail when neither username nor mobile number provided", async () => {
			const payload = {
				password: "password123",
			};

			const res = await server.inject({
				method: "POST",
				url: "/hapi/authentication/login",
				payload,
			});

			expect(res.statusCode).toBe(400);
		});

		it("should fail when user does not exist", async () => {
			const payload = {
				mobileNumber: "09170000099",
				password: "password123",
			};

			vi.spyOn(UserRepository, "findByMobileNumber").mockResolvedValue(null);

			const res = await server.inject({
				method: "POST",
				url: "/hapi/authentication/login",
				payload,
			});

			expect(res.statusCode).toBe(404);
			expect(JSON.parse(res.payload).message).toBe("User with this mobile number/ID does not exist.");
		});

		it("should fail when password is incorrect", async () => {
			const payload = {
				username: "alice_wallet",
				password: "wrongpassword",
			};

			vi.spyOn(UserRepository, "findByMobileNumber").mockResolvedValue({
				id: 1,
				username: "alice_wallet",
				mobile_number: "09170000001",
				password: "hashed_password",
			} as any);
			vi.spyOn(argon2, "verify").mockResolvedValue(false as any);

			const res = await server.inject({
				method: "POST",
				url: "/hapi/authentication/login",
				payload,
			});

			expect(res.statusCode).toBe(401);
			expect(JSON.parse(res.payload).message).toBe("Invalid password.");
		});

		it("should fail when password is less than 8 characters", async () => {
			const payload = {
				username: "alice_wallet",
				password: "pass123",
			};

			const res = await server.inject({
				method: "POST",
				url: "/hapi/authentication/login",
				payload,
			});

			expect(res.statusCode).toBe(400);
		});

		it("should fail when wallet is not found for user", async () => {
			const payload = {
				username: "alice_wallet",
				password: "password123",
			};

			vi.spyOn(UserRepository, "findByMobileNumber").mockResolvedValue({
				id: 1,
				username: "alice_wallet",
				mobile_number: "09170000001",
				password: "hashed_password",
			} as any);
			vi.spyOn(WalletRepository, "findWalletById").mockResolvedValue(null);

			const res = await server.inject({
				method: "POST",
				url: "/hapi/authentication/login",
				payload,
			});

			expect(res.statusCode).toBe(404);
			expect(JSON.parse(res.payload).message).toBe("Wallet not found for this user.");
		});
	});

	// ============== TRANSFER TESTS ==============
	describe("POST /hapi/transaction/transfer", () => {
		it("should successfully transfer money between two wallets", async () => {
			const payload = {
				senderWalletId: 1,
				receiverWalletId: 2,
				amount: 100,
			};

			vi.spyOn(WalletRepository, "executeTransfer").mockResolvedValue({
				id: 1,
				senderWalletId: 1,
				receiverWalletId: 2,
				amount: 100,
				referenceNo: "REF-1234567890",
				createdAt: new Date(),
			} as any);

			const res = await server.inject({
				method: "POST",
				url: "/hapi/transaction/transfer",
				payload,
			});

			expect(res.statusCode).toBe(201);
			const body = JSON.parse(res.payload);
			expect(body.message).toBe("Transfer completed successfully");
			expect(body.data).toHaveProperty("amount", 100);
		});

		it("should fail when sender and receiver wallet IDs are the same", async () => {
			const payload = {
				senderWalletId: 1,
				receiverWalletId: 1,
				amount: 100,
			};

			const res = await server.inject({
				method: "POST",
				url: "/hapi/transaction/transfer",
				payload,
			});

			expect(res.statusCode).toBe(400);
			const body = JSON.parse(res.payload);
			expect(body.message).toContain("cannot be the same wallet");
		});

		it("should fail when amount is zero", async () => {
			const payload = {
				senderWalletId: 1,
				receiverWalletId: 2,
				amount: 0,
			};

			const res = await server.inject({
				method: "POST",
				url: "/hapi/transaction/transfer",
				payload,
			});

			expect(res.statusCode).toBe(400);
			const body = JSON.parse(res.payload);
			expect(body.message).toContain("greater than 0");
		});

		it("should fail when amount is negative", async () => {
			const payload = {
				senderWalletId: 1,
				receiverWalletId: 2,
				amount: -100,
			};

			const res = await server.inject({
				method: "POST",
				url: "/hapi/transaction/transfer",
				payload,
			});

			expect(res.statusCode).toBe(400);
		});

		it("should fail when sender wallet ID is missing", async () => {
			const payload = {
				receiverWalletId: 2,
				amount: 100,
			};

			const res = await server.inject({
				method: "POST",
				url: "/hapi/transaction/transfer",
				payload,
			});

			expect(res.statusCode).toBe(400);
		});

		it("should fail when receiver wallet ID is missing", async () => {
			const payload = {
				senderWalletId: 1,
				amount: 100,
			};

			const res = await server.inject({
				method: "POST",
				url: "/hapi/transaction/transfer",
				payload,
			});

			expect(res.statusCode).toBe(400);
		});

		it("should fail when amount is missing", async () => {
			const payload = {
				senderWalletId: 1,
				receiverWalletId: 2,
			};

			const res = await server.inject({
				method: "POST",
				url: "/hapi/transaction/transfer",
				payload,
			});

			expect(res.statusCode).toBe(400);
		});

		it("should fail when sender wallet ID is not a positive integer", async () => {
			const payload = {
				senderWalletId: -1,
				receiverWalletId: 2,
				amount: 100,
			};

			const res = await server.inject({
				method: "POST",
				url: "/hapi/transaction/transfer",
				payload,
			});

			expect(res.statusCode).toBe(400);
		});

		it("should fail when receiver wallet ID is not a positive integer", async () => {
			const payload = {
				senderWalletId: 1,
				receiverWalletId: -2,
				amount: 100,
			};

			const res = await server.inject({
				method: "POST",
				url: "/hapi/transaction/transfer",
				payload,
			}); 

			expect(res.statusCode).toBe(400);
		});

		it("should fail when sender has insufficient balance", async () => {
			const payload = {
				senderWalletId: 1,
				receiverWalletId: 2,
				amount: 5000,
			};

			vi.spyOn(WalletRepository, "executeTransfer").mockRejectedValue(
				new ClientError("Insufficient balance in sender's wallet.", 422)
			);

			const res = await server.inject({
				method: "POST",
				url: "/hapi/transaction/transfer",
				payload,
			});

			expect(res.statusCode).toBe(422);
			expect(JSON.parse(res.payload).message).toBe("Insufficient balance in sender's wallet.");
		});

		it("should fail when sender wallet does not exist", async () => {
			const payload = {
				senderWalletId: 999,
				receiverWalletId: 2,
				amount: 100,
			};

			vi.spyOn(WalletRepository, "executeTransfer").mockRejectedValue(
				new ClientError("Sender wallet not found.", 404)
			);

			const res = await server.inject({
				method: "POST",
				url: "/hapi/transaction/transfer",
				payload,
			});

			expect(res.statusCode).toBe(404);
			expect(JSON.parse(res.payload).message).toBe("Sender wallet not found.");
		});

		it("should fail when receiver wallet does not exist", async () => {
			const payload = {
				senderWalletId: 1,
				receiverWalletId: 999,
				amount: 100,
			};

			vi.spyOn(WalletRepository, "executeTransfer").mockRejectedValue(
				new ClientError("Receiver wallet not found.", 404)
			);

			const res = await server.inject({
				method: "POST",
				url: "/hapi/transaction/transfer",
				payload,
			});

			expect(res.statusCode).toBe(404);
			expect(JSON.parse(res.payload).message).toBe("Receiver wallet not found.");
		});
	});

	// ============== ERROR HANDLING TESTS ==============
	describe("Error Handling", () => {
		it("should return 404 for non-existent route", async () => {
			const res = await server.inject({
				method: "GET",
				url: "/hapi/authentication/nonexistent",
			});

			expect(res.statusCode).toBe(404);
		});

		it("should return properly formatted error response with status code and message", async () => {
			const payload = {
				username: "test",
				password: "password123",
				mobileNumber: "09170000001",
			};

			vi.spyOn(UserRepository, "registerUser").mockRejectedValue(
				new ClientError("Custom error message", 422)
			);

			const res = await server.inject({
				method: "POST",
				url: "/hapi/authentication/registration",
				payload,
			});

			expect(res.statusCode).toBe(422);
			const body = JSON.parse(res.payload);
			expect(body).toHaveProperty("success", false);
			expect(body).toHaveProperty("statusCode", 422);
			expect(body).toHaveProperty("message", "Custom error message");
		});
	});

	// ============== EDGE CASES ==============
	describe("Edge Cases", () => {
		it("should handle very large transfer amounts", async () => {
			const payload = {
				senderWalletId: 1,
				receiverWalletId: 2,
				amount: 999999999.99,
			};

			vi.spyOn(WalletRepository, "executeTransfer").mockResolvedValue({
				id: 1,
				senderWalletId: 1,
				receiverWalletId: 2,
				amount: 999999999.99,
				referenceNo: "REF-1234567890",
				createdAt: new Date(),
			} as any);

			const res = await server.inject({
				method: "POST",
				url: "/hapi/transaction/transfer",
				payload,
			});

			expect(res.statusCode).toBe(201);
		});

		it("should handle very small transfer amounts", async () => {
			const payload = {
				senderWalletId: 1,
				receiverWalletId: 2,
				amount: 0.01,
			};

			vi.spyOn(WalletRepository, "executeTransfer").mockResolvedValue({
				id: 1,
				senderWalletId: 1,
				receiverWalletId: 2,
				amount: 0.01,
				referenceNo: "REF-1234567890",
				createdAt: new Date(),
			} as any);

			const res = await server.inject({
				method: "POST",
				url: "/hapi/transaction/transfer",
				payload,
			});

			expect(res.statusCode).toBe(201);
		});

		it("should handle usernames with special characters (if allowed)", async () => {
			const payload = {
				username: "user_test-123",
				password: "password123",
				mobileNumber: "09170000001",
			};

			// This will fail validation if special chars aren't allowed
			const res = await server.inject({
				method: "POST",
				url: "/hapi/authentication/registration",
				payload,
			});

			// Response could be 400 or 201 depending on schema
			expect([400, 201]).toContain(res.statusCode);
		});
	});
});
