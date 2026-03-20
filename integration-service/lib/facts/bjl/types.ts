export type BJLStatus = "active" | "closed" | "pending" | "unknown" | "withdrawn" | null;

export type Judgement = {
	count: number | null;
	most_recent: Date | null;
	most_recent_status: BJLStatus;
	most_recent_amount: number | null;
	total_judgement_amount: number | null;
};

export type Lien = {
	count: number | null;
	most_recent: Date | null;
	most_recent_status: BJLStatus;
	most_recent_amount: number | null;
	total_open_lien_amount: number | null;
};

export type Bankruptcy = {
	count: number | null;
	most_recent: Date | null;
	most_recent_status: BJLStatus;
};
