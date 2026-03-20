import { db } from "#helpers/knex";
import type IBanking from "../types";

type Record = IBanking.BankAccountVerificationRecord;

class BankAccountVerification {
	protected static readonly TABLE = "integration_data.rel_banking_verifications";

    public declare record: Record;
    constructor(record: Record) {
        this.record = record;
    }

    public static findByBankAccountId = async (bankAccountId: string): Promise<BankAccountVerification> => {
        const record = await db<Record>("integration_data.rel_banking_verifications as rbv")
        .leftJoin('integrations.core_giact_response_codes as verify_codes', 'rbv.giact_verify_response_code_id', 'verify_codes.id')
        .leftJoin('integrations.core_giact_response_codes as auth_codes', 'rbv.giact_authenticate_response_code_id', 'auth_codes.id')
        .select(
          'rbv.id',
          'rbv.verification_status',
          'rbv.created_at',
          'rbv.updated_at',
          db.raw(
            'json_build_object(\'name\', verify_codes.name, \'code\', verify_codes.code, \'description\', verify_codes.description, \'verification_response\', verify_codes.verification_response) as account_verification_response',
          ),
          db.raw(
            'json_build_object(\'name\', auth_codes.name, \'code\', auth_codes.code, \'description\', auth_codes.description, \'verification_response\', auth_codes.verification_response) as account_authentication_response',
          )
        )
        .where({ bank_account_id: bankAccountId })
        .orderBy('rbv.created_at', 'desc')
        .first();
        return new BankAccountVerification(record);
    }
}

export default BankAccountVerification;