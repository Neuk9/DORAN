/** 신청 URL이 아니라 지도/장소 링크인지 판별한다. */
export function isMapLink(url?: string | null): boolean {
  if (!url) return false;
  return /^https?:\/\/((place\.)?map\.kakao\.com|map\.naver\.com|maps\.app\.goo\.gl|(www\.)?google\.[a-z.]+\/maps)/i.test(
    url,
  );
}
