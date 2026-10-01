/**
 * A short list of common Nepali and Indian given names and surnames (Phase 9).
 * Used only to recognise an unlabelled capitalised pair such as "… with Sita Tamang" as a person;
 * a single listed word on its own is never removed, so words like "Asha" (hope) or "Lama" in
 * ordinary text are left alone. Names outside this list are still found from labels and cue phrases.
 */
export const COMMON_GIVEN_NAMES = [
  // Nepali
  'Aarati', 'Aashish', 'Anil', 'Anita', 'Anjali', 'Arjun', 'Asha', 'Babita', 'Bikash', 'Binod', 'Bishnu', 'Deepa', 'Deepak', 'Dipak',
  'Dipesh', 'Durga', 'Ganesh', 'Gita', 'Gopal', 'Hari', 'Indira', 'Kabita', 'Kamala', 'Kiran', 'Krishna', 'Kumar', 'Laxmi', 'Madhav',
  'Mahesh', 'Manish', 'Manoj', 'Maya', 'Meena', 'Mina', 'Nabin', 'Narayan', 'Nisha', 'Pooja', 'Prakash', 'Pramila', 'Rabin', 'Radha',
  'Rajan', 'Rajesh', 'Ram', 'Ramesh', 'Rekha', 'Rita', 'Roshan', 'Sabina', 'Sagar', 'Sandeep', 'Sangita', 'Santosh', 'Sarita', 'Shanti',
  'Shiva', 'Shyam', 'Sita', 'Sujan', 'Sunil', 'Sunita', 'Suresh', 'Sushila', 'Umesh',
  // Indian
  'Aditya', 'Akash', 'Amit', 'Anand', 'Anjana', 'Arun', 'Deepika', 'Divya', 'Kavita', 'Lakshmi', 'Neha', 'Pankaj', 'Pradeep', 'Priya',
  'Rahul', 'Rakesh', 'Ravi', 'Rohan', 'Sanjay', 'Seema', 'Shreya', 'Sneha', 'Sunitha', 'Vijay', 'Vikram', 'Vinod'
];

export const COMMON_SURNAMES = [
  // Nepali
  'Acharya', 'Adhikari', 'Bajracharya', 'Basnet', 'Bhandari', 'Bhattarai', 'Bista', 'Chhetri', 'Dahal', 'Gautam', 'Ghimire', 'Giri',
  'Gurung', 'Joshi', 'Kafle', 'Karki', 'Khadka', 'Khanal', 'KC', 'Koirala', 'Lama', 'Limbu', 'Magar', 'Maharjan', 'Neupane', 'Pandey',
  'Pant', 'Paudel', 'Poudel', 'Pokharel', 'Pradhan', 'Rai', 'Rana', 'Regmi', 'Sapkota', 'Sharma', 'Sherpa', 'Shrestha', 'Subedi',
  'Tamang', 'Thapa', 'Tiwari', 'Upadhyay',
  // Indian
  'Agarwal', 'Banerjee', 'Chaudhary', 'Das', 'Gupta', 'Iyer', 'Jain', 'Kumar', 'Mehta', 'Mishra', 'Nair', 'Patel', 'Reddy', 'Singh',
  'Verma', 'Yadav'
];

/** Devanagari labels that introduce a person's name, and honorifics written before one. */
export const DEVANAGARI_NAME_LABELS = [
  'बिरामीको नाम', 'रोगीको नाम', 'नाम थर', 'नाम', 'पिताको नाम', 'पतिको नाम', 'आमाको नाम', 'अभिभावक', 'सम्पर्क व्यक्ति', 'हेरचाहकर्ता',
  // family members written as a label ("बुवा: …")
  'बुवा', 'बाबु', 'आमा', 'पति', 'पत्नी', 'छोरा', 'छोरी', 'दाजु', 'भाइ', 'दिदी', 'बहिनी', 'आफन्त'
];
export const DEVANAGARI_HONORIFICS = ['श्रीमती', 'श्रीमान', 'सुश्री', 'श्री', 'डा.', 'डाक्टर', 'कुमारी'];

const lower = (xs: string[]) => new Set(xs.map((x) => x.toLowerCase()));
export const GIVEN_SET = lower(COMMON_GIVEN_NAMES);
export const SURNAME_SET = lower(COMMON_SURNAMES);
