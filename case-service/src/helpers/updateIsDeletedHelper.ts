import { sqlQuery } from "./database";

export const updateIsDeleted=async(schema:string, table:string, column:string, ids:string, value:boolean)=>{
    try{
        const updateIsDeletedQuery = `UPDATE ${schema}.${table} SET is_deleted = $1 WHERE ${column} =  ANY($2::uuid[])`
        const updateIsDeletedValues = [value, ids];
        
        await sqlQuery({sql:updateIsDeletedQuery, values: updateIsDeletedValues});
    }catch(error){
        throw error;
    }
}