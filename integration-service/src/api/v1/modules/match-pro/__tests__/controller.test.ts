import { controller } from "../controller";
import { matchConnection } from "../matchConnection";
import { secretsManagerService } from "#api/v1/modules/secrets/secrets";

// Mock dependencies
jest.mock("#api/v1/modules/secrets/secrets", () => ({
	secretsManagerService: {
		getSecret: jest.fn(),
		createSecret: jest.fn(),
		updateSecret: jest.fn()
	}
}));

jest.mock("../matchConnection", () => ({
	matchConnection: {
		checkConnection: jest.fn(),
		filterSecretResponse: jest.fn(),
		buildSecretsData: jest.fn(),
		extractPrivateKeyFromKeyFile: jest.fn()
	}
}));

jest.mock("#utils/index", () => ({
	catchAsync: (fn: any) => fn
}));

describe("Match-Pro Controller Tests", () => {
	let req: any;
	let res: any;

	beforeEach(() => {
		req = {
			params: { customerId: "test-customer-id" },
			body: {},
			file: undefined
		};
		res = {
			status: jest.fn().mockReturnThis(),
			json: jest.fn(),
			jsend: {
				success: jest.fn()
			}
		};
		jest.clearAllMocks();
	});

	describe("getCredentials", () => {
		it("should return credentials when secrets exist", async () => {
			const mockSecret = { storage_data: JSON.stringify({ key: "value" }) };
			const mockFilteredSecret = { key: "value" };

			(secretsManagerService.getSecret as jest.Mock).mockResolvedValue(mockSecret);
			(matchConnection.filterSecretResponse as jest.Mock).mockReturnValue(mockFilteredSecret);

			await controller.getCredentials(req, res, jest.fn());

			expect(secretsManagerService.getSecret).toHaveBeenCalledWith("test-customer-id");
			expect(matchConnection.filterSecretResponse).toHaveBeenCalledWith(mockSecret);
			expect(res.jsend.success).toHaveBeenCalledWith(mockFilteredSecret, "Credentials retrieved successfully");
		});

		it("should return success with null data when secrets do not exist", async () => {
			(secretsManagerService.getSecret as jest.Mock).mockResolvedValue(null);

			await controller.getCredentials(req, res, jest.fn());

			expect(secretsManagerService.getSecret).toHaveBeenCalledWith("test-customer-id");
			// Verify filterSecretResponse is NOT called since secret is null and handled early
			expect(matchConnection.filterSecretResponse).not.toHaveBeenCalled();
			// Verify it returns success with null
			expect(res.jsend.success).toHaveBeenCalledWith(null, "Credentials not found");
		});

		it("should propagate errors from secretsManagerService", async () => {
			const error = new Error("Database error");
			(secretsManagerService.getSecret as jest.Mock).mockRejectedValue(error);

			await expect(controller.getCredentials(req, res, jest.fn())).rejects.toThrow("Database error");
		});
	});
});
