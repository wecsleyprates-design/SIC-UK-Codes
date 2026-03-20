type StarRating = "STAR_RATING_UNSPECIFIED" | "ONE" | "TWO" | "THREE" | "FOUR" | "FIVE";

export type GoogleReview = {
  "name": string,
  "reviewId": string,
  "starRating": StarRating,
  "comment": string,
  "createTime": string,
  "updateTime": string,
  // Note: reviewer & reviewReply are removed from the type as we don't need them
}


export type ReviewsJobBody = {
  accountName: string,
  locationName: string,
  token: string,
  queryParams: { pageToken: string } & Record<string, string>,
  lastFetchedReviewDate?: string,
  business_id: string,
  connection_id: string,
  business_integration_task_id: string
}