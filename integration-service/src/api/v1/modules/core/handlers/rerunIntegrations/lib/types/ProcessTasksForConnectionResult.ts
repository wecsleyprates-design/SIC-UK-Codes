export interface ProcessTasksForConnectionResult {
	tasksCreated: Array<{ connection_id: string; platform_code: string; task_code: string; task_id: string }>;
	errors: Array<{ connection_id: string; platform_code: string; error: string }>;
}
