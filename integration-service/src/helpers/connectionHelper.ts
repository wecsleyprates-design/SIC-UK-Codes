import { CONNECTION_STATUS, TASK_STATUS } from '#constants';
import {v4 as uuidv4} from 'uuid';
import { sqlTransaction } from './database';

type ConnectionData = {
  business_id: string, 
  platform_id: string, 
  integration_task_id: string, 
  business_score_trigger_id: string,
  connection_status?: string,
}

/**
 * @description Handle platform connection not found. So this can be used whenever we introduced a new platform and the connection is not found in the database for a business.
 * @param data {ConnectionData}: business_id, platform_id, integration_task_id, business_score_trigger_id for creating connction & integration task
 */
export const handlePlatformConnectionNotFound = async(data: ConnectionData) => {
  const { business_id, platform_id, integration_task_id, business_score_trigger_id } = data;
  // create connection, connection history & business integration task
  const insertConnectionQuery = `INSERT INTO integrations.data_connections (id, business_id, platform_id, configuration, connection_status, created_at, updated_at) VALUES ($1, $2, $3, $4, $5, $6, $7);`
  const insertConnectionHistoryQuery = `INSERT INTO integrations.data_connections_history (id, connection_id, connection_status, created_at) VALUES ($1, $2, $3, $4);`
  const insertBusinessIntegrationTaskQuery = `INSERT INTO integrations.data_business_integrations_tasks (id, connection_id, integration_task_id, business_score_trigger_id, task_status, reference_id, metadata, created_at, updated_at) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9);`

  const connectionID = uuidv4();
  const connectionStatus = data?.connection_status || CONNECTION_STATUS.CREATED;
  const now = new Date().toISOString() ;
  const insertConnectionValues = [connectionID, business_id, platform_id, null, connectionStatus, now, now];
  const insertConnectionHistoryValues = [uuidv4(), connectionID, connectionStatus, now];
  const insertBusinessIntegrationTaskValues = [uuidv4(), connectionID, integration_task_id, business_score_trigger_id, TASK_STATUS.CREATED, null, null, now, now];
  
  await sqlTransaction([insertConnectionQuery, insertConnectionHistoryQuery, insertBusinessIntegrationTaskQuery], [insertConnectionValues, insertConnectionHistoryValues, insertBusinessIntegrationTaskValues]);
}