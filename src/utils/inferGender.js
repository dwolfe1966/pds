// Lightweight first-name → gender inference, for AVATAR DISPLAY ONLY (never a
// factual claim about a person). Covers common US given names; anything unknown
// or ambiguous returns undefined so the card falls back to a neutral person icon.
const MALE = new Set(['james', 'john', 'robert', 'michael', 'william', 'david', 'richard', 'joseph', 'thomas', 'charles', 'christopher', 'daniel', 'matthew', 'anthony', 'mark', 'donald', 'steven', 'paul', 'andrew', 'joshua', 'kenneth', 'kevin', 'brian', 'george', 'timothy', 'ronald', 'edward', 'jason', 'jeffrey', 'ryan', 'jacob', 'gary', 'nicholas', 'eric', 'jonathan', 'stephen', 'larry', 'justin', 'scott', 'brandon', 'benjamin', 'samuel', 'gregory', 'frank', 'alexander', 'raymond', 'patrick', 'jack', 'dennis', 'jerry', 'tyler', 'aaron', 'jose', 'henry', 'adam', 'douglas', 'nathan', 'peter', 'zachary', 'kyle', 'walter', 'harold', 'jeremy', 'ethan', 'carl', 'keith', 'roger', 'gerald', 'christian', 'terry', 'sean', 'arthur', 'austin', 'noah', 'lawrence', 'jesse', 'joe', 'bryan', 'billy', 'jordan', 'albert', 'dylan', 'bruce', 'willie', 'gabriel', 'alan', 'juan', 'logan', 'wayne', 'ralph', 'roy', 'eugene', 'randy', 'vincent', 'russell', 'louis', 'philip', 'bobby', 'johnny', 'bradley']);
const FEMALE = new Set(['mary', 'patricia', 'jennifer', 'linda', 'elizabeth', 'barbara', 'susan', 'jessica', 'sarah', 'karen', 'nancy', 'lisa', 'margaret', 'betty', 'sandra', 'ashley', 'dorothy', 'kimberly', 'emily', 'donna', 'michelle', 'carol', 'amanda', 'melissa', 'deborah', 'stephanie', 'rebecca', 'sharon', 'laura', 'cynthia', 'kathleen', 'amy', 'angela', 'shirley', 'anna', 'brenda', 'pamela', 'emma', 'nicole', 'helen', 'samantha', 'katherine', 'christine', 'debra', 'rachel', 'carolyn', 'janet', 'catherine', 'maria', 'heather', 'diane', 'ruth', 'julie', 'olivia', 'joyce', 'virginia', 'victoria', 'kelly', 'lauren', 'christina', 'joan', 'evelyn', 'judith', 'megan', 'andrea', 'cheryl', 'hannah', 'jacqueline', 'martha', 'gloria', 'teresa', 'ann', 'sara', 'madison', 'frances', 'kathryn', 'janice', 'jean', 'abigail', 'alice', 'julia', 'judy', 'sophia', 'grace', 'denise', 'amber', 'doris', 'marilyn', 'danielle', 'beverly', 'isabella', 'theresa', 'diana', 'natalie', 'brittany', 'charlotte', 'marie', 'kayla', 'alexis', 'lori']);

export function inferGender(firstName) {
  const n = String(firstName || '').trim().toLowerCase().replace(/[^a-z].*$/, '');
  if (!n) return undefined;
  if (MALE.has(n)) return 'male';
  if (FEMALE.has(n)) return 'female';
  return undefined;
}
