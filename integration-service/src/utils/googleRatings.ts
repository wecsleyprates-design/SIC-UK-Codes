export const getGoogleRatingMapping = (startRating: string): number => {

  if(typeof startRating === "number") {
    return startRating;
  } 

  switch (startRating) {
    case "STAR_RATING_UNSPECIFIED":
      return 0;
    case "ONE":
      return 1;
    case "TWO":
      return 2;
    case "THREE":
      return 3;
    case "FOUR":
      return 4;
    case "FIVE":
      return 5;
    default:
      return 0;
  }
  
}