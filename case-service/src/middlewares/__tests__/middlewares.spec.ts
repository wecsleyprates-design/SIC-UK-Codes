import { validateDataPermission } from '../access.middleware';
import { StatusCodes } from 'http-status-codes';
import { ROLE_ID, ERROR_CODES } from '#constants/index';
import { customer } from '../../api/v1/modules/customer/customer';

require("kafkajs");
jest.mock("kafkajs");
jest.mock('../../utils/stripe.ts');
jest.mock('../../api/v1/modules/customer/customer');

// access.middleware.ts
describe('validateDataPermission middleware', () => {
    let req, res, next;

    beforeEach(() => {
        jest.clearAllMocks();

        req = {
            params: { id: '123' }
        };
        res = {
            locals: {
                user: {
                    role: { id: ROLE_ID.CUSTOMER },
                    id: 'user-1'
                }
            }
        };
        next = jest.fn();
    });

    it('should call next() if access is granted', async () => {
        (customer._validateDataPermission as jest.Mock).mockResolvedValue(true);

        await validateDataPermission(req, res, next);

        expect(customer._validateDataPermission).toHaveBeenCalledWith(req.params, res.locals.user);
        expect(next).toHaveBeenCalledWith(); // no error
    });

    it('should call next(error) if access is denied', async () => {
        (customer._validateDataPermission as jest.Mock).mockResolvedValue(false);

        await validateDataPermission(req, res, next);

        expect(next).toHaveBeenCalledWith(expect.objectContaining({
            status: StatusCodes.FORBIDDEN,
            errorCode: ERROR_CODES.UNAUTHORIZED,
            message: "You are not allowed to access the data."
        }));
    });

    it('should skip validation if user is not a CUSTOMER', async () => {
        res.locals.user.role.id = 'ADMIN';

        await validateDataPermission(req, res, next);

        expect(customer._validateDataPermission).not.toHaveBeenCalled();
        expect(next).toHaveBeenCalledWith();
    });

    it('should call next(error) if _validateDataPermission throws', async () => {
        const mockError = new Error("Something went wrong");
        (customer._validateDataPermission as jest.Mock).mockRejectedValue(mockError);

        await validateDataPermission(req, res, next);

        expect(next).toHaveBeenCalledWith(mockError);
    });
});
