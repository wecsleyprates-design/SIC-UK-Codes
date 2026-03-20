import { TDateISO } from "./datetime"

export namespace PublicRecordsTypes {
    export type PublicRecordsRows = {
        rows: PublicRecordsRow[]
    }
    
    export interface PublicRecordsRow  {
        id: string
        business_integration_task_id: string 
        number_of_business_liens : string
        most_recent_business_lien_filing_date : string
        most_recent_business_lien_status : string
        number_of_bankruptcies : string
        most_recent_bankruptcy_filing_date : string
        number_of_judgement_fillings : string
        most_recent_judgement_filling_date : string
        corporate_filing_business_name : string
        corporate_filing_filling_date : string
        corporate_filing_incorporation_state : string
        corporate_filing_corporation_type : string
        corporate_filing_resgistration_type : string
        corporate_filing_secretary_of_state_status : string
        corporate_filing_secretary_of_state_status_date : string,
        average_rating : number
        angi_review_count  : number
        angi_review_percentage : number
        bbb_review_count : number
        bbb_review_percentage : number
        google_review_count : number
        google_review_percentage : number
        yelp_review_count : number
        yelp_review_percentage : number
        healthgrades_review_count : number
        healthgrades_review_percentage : number
        vitals_review_count: number
        vitals_review_percentage : number
        webmd_review_count : number
        webmd_review_percentage : number
        created_at : TDateISO	
        updated_at : TDateISO
        monthly_rating : number	
        monthly_rating_date : TDateISO
    }
    
    export interface RequestResponseRow {
        request_id : string
        business_id : string
        platform_id : number
        external_id : string
        request_type : string
        requested_at : TDateISO
        connection_id : string
        response : Object
        request_received : TDateISO
        org_id : string
        request_code : string
        idempotency_key : string
        async_key : string
        status : number
    }
}
