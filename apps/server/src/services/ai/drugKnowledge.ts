/**
 * Offline drug knowledge base: plain-language drug information, well-established
 * drug–drug interactions and allergy cross-reactions.
 *
 * This is an educational reference for the project. It is intentionally conservative and
 * NOT a replacement for a pharmacist's review or a full clinical interaction database.
 */

export interface DrugInfo {
  name: string;
  /** Lower-case names/brands that map to this drug. */
  aliases: string[];
  classes: string[];
  purpose: string;
  commonSideEffects: string[];
  precautions: string[];
}

export const DRUGS: DrugInfo[] = [
  // Pain / anti-inflammatory
  { name: 'Paracetamol', aliases: ['paracetamol', 'acetaminophen', 'crocin', 'dolo', 'calpol', 'tylenol', 'cetamol'], classes: ['analgesic'],
    purpose: 'Relieves pain and lowers fever.', commonSideEffects: ['Rarely nausea or rash'],
    precautions: ['Do not take more than the maximum daily dose — overdose can seriously damage the liver.', 'Check other cold/flu products, which often contain paracetamol too.'] },
  { name: 'Ibuprofen', aliases: ['ibuprofen', 'brufen', 'advil', 'motrin', 'nurofen'], classes: ['nsaid', 'nsaid_analgesic'],
    purpose: 'Relieves pain, inflammation and fever.', commonSideEffects: ['Stomach upset', 'Heartburn', 'Nausea'],
    precautions: ['Take with food.', 'Can irritate the stomach and affect the kidneys; use the lowest dose for the shortest time.'] },
  { name: 'Diclofenac', aliases: ['diclofenac', 'voveran', 'voltaren'], classes: ['nsaid', 'nsaid_analgesic'],
    purpose: 'Relieves pain and inflammation (e.g. joint pain).', commonSideEffects: ['Stomach upset', 'Headache', 'Dizziness'],
    precautions: ['Take with food.', 'Can raise blood pressure and affect the kidneys and stomach lining.'] },
  { name: 'Naproxen', aliases: ['naproxen', 'naprosyn', 'aleve'], classes: ['nsaid', 'nsaid_analgesic'],
    purpose: 'Relieves pain and inflammation.', commonSideEffects: ['Stomach upset', 'Heartburn', 'Drowsiness'],
    precautions: ['Take with food.', 'Can irritate the stomach and affect the kidneys.'] },
  { name: 'Aspirin', aliases: ['aspirin', 'ecosprin', 'disprin', 'acetylsalicylic acid'], classes: ['nsaid', 'antiplatelet'],
    purpose: 'In low doses, helps prevent blood clots (heart attack and stroke prevention); in higher doses relieves pain.',
    commonSideEffects: ['Stomach irritation', 'Easy bruising'], precautions: ['Increases bleeding risk.', 'Not for children or teenagers with viral illness.'] },
  { name: 'Tramadol', aliases: ['tramadol', 'ultram', 'contramal'], classes: ['opioid', 'serotonergic'],
    purpose: 'Relieves moderate to severe pain.', commonSideEffects: ['Nausea', 'Dizziness', 'Constipation', 'Drowsiness'],
    precautions: ['Can cause dependence.', 'Do not combine with alcohol or sedatives.'] },
  { name: 'Codeine', aliases: ['codeine'], classes: ['opioid'], purpose: 'Relieves mild to moderate pain and cough.',
    commonSideEffects: ['Constipation', 'Drowsiness', 'Nausea'], precautions: ['Can cause dependence.', 'Avoid alcohol and sedatives.'] },
  { name: 'Morphine', aliases: ['morphine'], classes: ['opioid'], purpose: 'Relieves severe pain.',
    commonSideEffects: ['Constipation', 'Drowsiness', 'Nausea'], precautions: ['Can slow breathing, especially with sedatives or alcohol.'] },

  // Blood thinners
  { name: 'Warfarin', aliases: ['warfarin', 'coumadin'], classes: ['anticoagulant'],
    purpose: 'Thins the blood to prevent and treat clots.', commonSideEffects: ['Bleeding or bruising more easily'],
    precautions: ['Needs regular INR blood tests.', 'Many medicines and some foods change its effect — tell every prescriber you take it.'] },
  { name: 'Clopidogrel', aliases: ['clopidogrel', 'plavix', 'clopilet'], classes: ['antiplatelet'],
    purpose: 'Prevents blood clots after heart attack, stroke or stent.', commonSideEffects: ['Bruising', 'Bleeding'],
    precautions: ['Do not stop suddenly without your doctor\'s advice.'] },

  // Heart & blood pressure
  { name: 'Amlodipine', aliases: ['amlodipine', 'amlong', 'norvasc', 'amlodac'], classes: ['calcium_channel_blocker'],
    purpose: 'Lowers blood pressure and helps prevent chest pain.', commonSideEffects: ['Ankle swelling', 'Flushing', 'Headache'],
    precautions: ['Stand up slowly if you feel dizzy.'] },
  { name: 'Lisinopril', aliases: ['lisinopril', 'zestril'], classes: ['ace_inhibitor'],
    purpose: 'Lowers blood pressure and protects the heart and kidneys.', commonSideEffects: ['Dry cough', 'Dizziness'],
    precautions: ['Can raise potassium levels.', 'Seek help urgently for swelling of the face or lips.'] },
  { name: 'Enalapril', aliases: ['enalapril', 'envas'], classes: ['ace_inhibitor'],
    purpose: 'Lowers blood pressure and helps in heart failure.', commonSideEffects: ['Dry cough', 'Dizziness'], precautions: ['Can raise potassium levels.'] },
  { name: 'Ramipril', aliases: ['ramipril', 'cardace'], classes: ['ace_inhibitor'],
    purpose: 'Lowers blood pressure and protects the heart.', commonSideEffects: ['Dry cough', 'Dizziness'], precautions: ['Can raise potassium levels.'] },
  { name: 'Losartan', aliases: ['losartan', 'losar', 'cozaar'], classes: ['arb'],
    purpose: 'Lowers blood pressure and protects the kidneys.', commonSideEffects: ['Dizziness'], precautions: ['Can raise potassium levels.'] },
  { name: 'Telmisartan', aliases: ['telmisartan', 'telma', 'micardis'], classes: ['arb'],
    purpose: 'Lowers blood pressure.', commonSideEffects: ['Dizziness', 'Back pain'], precautions: ['Can raise potassium levels.'] },
  { name: 'Metoprolol', aliases: ['metoprolol', 'metolar', 'lopressor', 'betaloc'], classes: ['beta_blocker'],
    purpose: 'Slows the heart and lowers blood pressure.', commonSideEffects: ['Tiredness', 'Cold hands', 'Slow pulse'],
    precautions: ['Do not stop suddenly.'] },
  { name: 'Atenolol', aliases: ['atenolol', 'tenormin', 'aten'], classes: ['beta_blocker'],
    purpose: 'Slows the heart and lowers blood pressure.', commonSideEffects: ['Tiredness', 'Cold hands'], precautions: ['Do not stop suddenly.'] },
  { name: 'Propranolol', aliases: ['propranolol', 'inderal', 'ciplar'], classes: ['beta_blocker', 'nonselective_beta_blocker'],
    purpose: 'Controls heart rate, blood pressure, tremor and migraine.', commonSideEffects: ['Tiredness', 'Cold hands', 'Sleep disturbance'],
    precautions: ['Can worsen asthma.', 'Do not stop suddenly.'] },
  { name: 'Verapamil', aliases: ['verapamil', 'calaptin'], classes: ['rate_limiting_ccb'],
    purpose: 'Controls heart rate and blood pressure.', commonSideEffects: ['Constipation', 'Dizziness'], precautions: ['Can slow the heart.'] },
  { name: 'Diltiazem', aliases: ['diltiazem', 'dilzem'], classes: ['rate_limiting_ccb'],
    purpose: 'Controls heart rate, chest pain and blood pressure.', commonSideEffects: ['Ankle swelling', 'Dizziness'], precautions: ['Can slow the heart.'] },
  { name: 'Spironolactone', aliases: ['spironolactone', 'aldactone'], classes: ['potassium_sparing_diuretic'],
    purpose: 'Removes extra fluid and helps in heart failure and high blood pressure.', commonSideEffects: ['Increased urination', 'Breast tenderness'],
    precautions: ['Can raise potassium levels — blood tests are needed.'] },
  { name: 'Hydrochlorothiazide', aliases: ['hydrochlorothiazide', 'hctz'], classes: ['thiazide'],
    purpose: 'Water tablet that lowers blood pressure.', commonSideEffects: ['Increased urination', 'Dizziness'], precautions: ['Can lower potassium and sodium.'] },
  { name: 'Furosemide', aliases: ['furosemide', 'frusemide', 'lasix'], classes: ['loop_diuretic'],
    purpose: 'Water tablet that removes excess fluid.', commonSideEffects: ['Increased urination', 'Dizziness'], precautions: ['Can lower potassium.'] },
  { name: 'Potassium chloride', aliases: ['potassium chloride', 'potassium supplement', 'kcl'], classes: ['potassium'],
    purpose: 'Replaces low potassium.', commonSideEffects: ['Stomach upset'], precautions: ['Too much potassium can affect heart rhythm.'] },
  { name: 'Digoxin', aliases: ['digoxin', 'lanoxin'], classes: ['cardiac_glycoside'],
    purpose: 'Controls heart rate and helps heart failure.', commonSideEffects: ['Nausea', 'Loss of appetite'], precautions: ['Narrow safety margin — levels may need checking.'] },
  { name: 'Amiodarone', aliases: ['amiodarone', 'cordarone'], classes: ['antiarrhythmic'],
    purpose: 'Treats irregular heart rhythms.', commonSideEffects: ['Sun sensitivity', 'Nausea'], precautions: ['Needs regular thyroid, liver and lung monitoring.'] },
  { name: 'Nitroglycerin', aliases: ['nitroglycerin', 'glyceryl trinitrate', 'gtn', 'sorbitrate', 'isosorbide', 'isosorbide mononitrate', 'isosorbide dinitrate'], classes: ['nitrate'],
    purpose: 'Relieves or prevents chest pain (angina).', commonSideEffects: ['Headache', 'Dizziness', 'Flushing'], precautions: ['Sit down when using it — it can lower blood pressure.'] },
  { name: 'Sildenafil', aliases: ['sildenafil', 'viagra'], classes: ['pde5_inhibitor'],
    purpose: 'Treats erectile dysfunction and some lung blood-pressure conditions.', commonSideEffects: ['Headache', 'Flushing'], precautions: ['Never combine with nitrate medicines.'] },
  { name: 'Tadalafil', aliases: ['tadalafil', 'cialis'], classes: ['pde5_inhibitor'],
    purpose: 'Treats erectile dysfunction and enlarged prostate symptoms.', commonSideEffects: ['Headache', 'Back pain'], precautions: ['Never combine with nitrate medicines.'] },

  // Cholesterol
  { name: 'Atorvastatin', aliases: ['atorvastatin', 'lipitor', 'atorva'], classes: ['statin'],
    purpose: 'Lowers cholesterol and reduces heart-attack and stroke risk.', commonSideEffects: ['Muscle aches', 'Stomach upset'],
    precautions: ['Report unexplained muscle pain or weakness.'] },
  { name: 'Simvastatin', aliases: ['simvastatin', 'zocor'], classes: ['statin'],
    purpose: 'Lowers cholesterol.', commonSideEffects: ['Muscle aches'], precautions: ['Report unexplained muscle pain.', 'Avoid large amounts of grapefruit juice.'] },
  { name: 'Rosuvastatin', aliases: ['rosuvastatin', 'crestor', 'rosuvas'], classes: ['statin'],
    purpose: 'Lowers cholesterol.', commonSideEffects: ['Muscle aches', 'Headache'], precautions: ['Report unexplained muscle pain.'] },

  // Diabetes & thyroid
  { name: 'Metformin', aliases: ['metformin', 'glycomet', 'glucophage'], classes: ['biguanide'],
    purpose: 'Lowers blood sugar in type 2 diabetes.', commonSideEffects: ['Stomach upset', 'Diarrhoea', 'Metallic taste'],
    precautions: ['Take with meals.', 'May be paused before scans that use contrast dye or major surgery.'] },
  { name: 'Glimepiride', aliases: ['glimepiride', 'amaryl'], classes: ['sulfonylurea'],
    purpose: 'Lowers blood sugar in type 2 diabetes.', commonSideEffects: ['Low blood sugar', 'Weight gain'], precautions: ['Do not skip meals.'] },
  { name: 'Insulin', aliases: ['insulin', 'insulin glargine', 'lantus', 'mixtard', 'actrapid'], classes: ['insulin'],
    purpose: 'Lowers blood sugar.', commonSideEffects: ['Low blood sugar', 'Injection-site reactions'], precautions: ['Know the signs of low blood sugar.'] },
  { name: 'Levothyroxine', aliases: ['levothyroxine', 'thyroxine', 'eltroxin', 'thyronorm', 'synthroid'], classes: ['thyroid_hormone'],
    purpose: 'Replaces thyroid hormone when the thyroid is underactive.', commonSideEffects: ['Usually none at the right dose'],
    precautions: ['Take on an empty stomach, 30–60 minutes before breakfast.'] },

  // Stomach
  { name: 'Omeprazole', aliases: ['omeprazole', 'omez', 'prilosec'], classes: ['ppi', 'cyp2c19_inhibitor'],
    purpose: 'Reduces stomach acid (heartburn, ulcers).', commonSideEffects: ['Headache', 'Stomach upset'], precautions: ['Long-term use should be reviewed by a doctor.'] },
  { name: 'Esomeprazole', aliases: ['esomeprazole', 'nexium', 'nexpro'], classes: ['ppi', 'cyp2c19_inhibitor'],
    purpose: 'Reduces stomach acid.', commonSideEffects: ['Headache'], precautions: ['Long-term use should be reviewed by a doctor.'] },
  { name: 'Pantoprazole', aliases: ['pantoprazole', 'pan', 'pantocid', 'protonix'], classes: ['ppi'],
    purpose: 'Reduces stomach acid.', commonSideEffects: ['Headache', 'Diarrhoea'], precautions: ['Long-term use should be reviewed by a doctor.'] },
  { name: 'Antacid', aliases: ['antacid', 'gelusil', 'digene', 'aluminium hydroxide', 'magnesium hydroxide'], classes: ['antacid', 'binder'],
    purpose: 'Neutralises stomach acid for quick heartburn relief.', commonSideEffects: ['Constipation or diarrhoea'], precautions: ['Can reduce absorption of other medicines — separate doses.'] },
  { name: 'Calcium carbonate', aliases: ['calcium carbonate', 'calcium', 'shelcal'], classes: ['binder'],
    purpose: 'Calcium supplement / antacid.', commonSideEffects: ['Constipation'], precautions: ['Separate from thyroid tablets and some antibiotics.'] },
  { name: 'Iron', aliases: ['ferrous sulfate', 'ferrous sulphate', 'iron', 'ferrous fumarate'], classes: ['binder'],
    purpose: 'Treats iron-deficiency anaemia.', commonSideEffects: ['Dark stools', 'Constipation', 'Stomach upset'], precautions: ['Separate from thyroid tablets, antacids and some antibiotics.'] },
  { name: 'Ondansetron', aliases: ['ondansetron', 'zofran', 'emeset'], classes: ['antiemetic'],
    purpose: 'Prevents nausea and vomiting.', commonSideEffects: ['Headache', 'Constipation'], precautions: [] },

  // Antibiotics / antifungals
  { name: 'Amoxicillin', aliases: ['amoxicillin', 'amoxycillin', 'mox', 'amoxil'], classes: ['penicillin', 'antibiotic'],
    purpose: 'Antibiotic for bacterial infections.', commonSideEffects: ['Diarrhoea', 'Nausea', 'Rash'], precautions: ['Finish the full course.', 'Not for people allergic to penicillin.'] },
  { name: 'Amoxicillin-clavulanate', aliases: ['amoxicillin-clavulanate', 'amoxicillin clavulanate', 'co-amoxiclav', 'augmentin', 'clavam'], classes: ['penicillin', 'antibiotic'],
    purpose: 'Antibiotic for bacterial infections.', commonSideEffects: ['Diarrhoea', 'Nausea'], precautions: ['Finish the full course.', 'Not for people allergic to penicillin.'] },
  { name: 'Ampicillin', aliases: ['ampicillin'], classes: ['penicillin', 'antibiotic'], purpose: 'Antibiotic.', commonSideEffects: ['Diarrhoea', 'Rash'], precautions: ['Not for people allergic to penicillin.'] },
  { name: 'Cephalexin', aliases: ['cephalexin', 'cefalexin', 'keflex'], classes: ['cephalosporin', 'antibiotic'],
    purpose: 'Antibiotic for skin, urine and other infections.', commonSideEffects: ['Diarrhoea', 'Nausea'], precautions: ['Tell your doctor if you are allergic to penicillin.'] },
  { name: 'Ceftriaxone', aliases: ['ceftriaxone', 'rocephin', 'monocef'], classes: ['cephalosporin', 'antibiotic'],
    purpose: 'Injectable antibiotic for serious infections.', commonSideEffects: ['Injection-site pain', 'Diarrhoea'], precautions: ['Tell your doctor if you are allergic to penicillin.'] },
  { name: 'Azithromycin', aliases: ['azithromycin', 'azithral', 'zithromax', 'azee'], classes: ['macrolide', 'antibiotic'],
    purpose: 'Antibiotic for chest, throat and other infections.', commonSideEffects: ['Diarrhoea', 'Nausea'], precautions: ['Finish the full course.'] },
  { name: 'Clarithromycin', aliases: ['clarithromycin', 'klacid', 'claribid'], classes: ['macrolide', 'antibiotic', 'strong_cyp3a4_inhibitor'],
    purpose: 'Antibiotic for chest and stomach (H. pylori) infections.', commonSideEffects: ['Taste changes', 'Nausea'], precautions: ['Interacts with many medicines.'] },
  { name: 'Erythromycin', aliases: ['erythromycin'], classes: ['macrolide', 'antibiotic', 'strong_cyp3a4_inhibitor'],
    purpose: 'Antibiotic.', commonSideEffects: ['Stomach upset'], precautions: ['Interacts with many medicines.'] },
  { name: 'Ciprofloxacin', aliases: ['ciprofloxacin', 'cipro', 'ciplox'], classes: ['fluoroquinolone', 'antibiotic'],
    purpose: 'Antibiotic for urine, gut and other infections.', commonSideEffects: ['Nausea', 'Diarrhoea', 'Dizziness'],
    precautions: ['Take 2 hours before or 6 hours after antacids, calcium or iron.', 'Rarely causes tendon problems.'] },
  { name: 'Levofloxacin', aliases: ['levofloxacin', 'levoflox'], classes: ['fluoroquinolone', 'antibiotic'],
    purpose: 'Antibiotic for chest, urine and other infections.', commonSideEffects: ['Nausea', 'Headache'], precautions: ['Separate from antacids, calcium or iron.'] },
  { name: 'Metronidazole', aliases: ['metronidazole', 'flagyl', 'metrogyl'], classes: ['antibiotic'],
    purpose: 'Antibiotic for gut, dental and gynaecological infections.', commonSideEffects: ['Metallic taste', 'Nausea'], precautions: ['Avoid alcohol during and for 48 hours after the course.'] },
  { name: 'Co-trimoxazole', aliases: ['co-trimoxazole', 'cotrimoxazole', 'trimethoprim-sulfamethoxazole', 'sulfamethoxazole', 'bactrim', 'septran'], classes: ['sulfonamide', 'antibiotic', 'trimethoprim'],
    purpose: 'Antibiotic for urine, chest and other infections.', commonSideEffects: ['Rash', 'Nausea'], precautions: ['Not for people allergic to sulfa drugs.', 'Can raise potassium.'] },
  { name: 'Fluconazole', aliases: ['fluconazole', 'diflucan', 'forcan'], classes: ['azole_antifungal'],
    purpose: 'Treats fungal infections.', commonSideEffects: ['Headache', 'Nausea'], precautions: ['Interacts with several medicines, including warfarin.'] },
  { name: 'Linezolid', aliases: ['linezolid', 'zyvox'], classes: ['antibiotic', 'maoi_like'], purpose: 'Antibiotic for resistant infections.',
    commonSideEffects: ['Diarrhoea', 'Headache'], precautions: ['Interacts with antidepressants.'] },

  // Mental health & nerves
  { name: 'Sertraline', aliases: ['sertraline', 'zoloft', 'serta'], classes: ['ssri', 'serotonergic'],
    purpose: 'Treats depression and anxiety.', commonSideEffects: ['Nausea', 'Sleep changes', 'Headache'], precautions: ['Takes 2–4 weeks to work; do not stop suddenly.'] },
  { name: 'Fluoxetine', aliases: ['fluoxetine', 'prozac', 'fludac'], classes: ['ssri', 'serotonergic'],
    purpose: 'Treats depression and anxiety.', commonSideEffects: ['Nausea', 'Sleep changes'], precautions: ['Do not stop suddenly.'] },
  { name: 'Escitalopram', aliases: ['escitalopram', 'lexapro', 'nexito'], classes: ['ssri', 'serotonergic'],
    purpose: 'Treats depression and anxiety.', commonSideEffects: ['Nausea', 'Tiredness'], precautions: ['Do not stop suddenly.'] },
  { name: 'Paroxetine', aliases: ['paroxetine', 'paxil'], classes: ['ssri', 'serotonergic'],
    purpose: 'Treats depression and anxiety.', commonSideEffects: ['Nausea', 'Drowsiness'], precautions: ['Do not stop suddenly.'] },
  { name: 'Phenelzine', aliases: ['phenelzine', 'selegiline', 'moclobemide'], classes: ['maoi', 'maoi_like'],
    purpose: 'Treats depression (MAO inhibitor).', commonSideEffects: ['Dizziness', 'Sleep changes'], precautions: ['Strict food and medicine restrictions apply.'] },
  { name: 'Lithium', aliases: ['lithium', 'lithosun', 'licab'], classes: ['lithium'],
    purpose: 'Stabilises mood in bipolar disorder.', commonSideEffects: ['Thirst', 'Tremor', 'Frequent urination'],
    precautions: ['Needs regular blood level checks.', 'Dehydration can raise levels.'] },
  { name: 'Alprazolam', aliases: ['alprazolam', 'xanax', 'alprax'], classes: ['benzodiazepine', 'sedative'],
    purpose: 'Relieves anxiety.', commonSideEffects: ['Drowsiness', 'Dizziness'], precautions: ['Can cause dependence.', 'Do not drive if drowsy.'] },
  { name: 'Diazepam', aliases: ['diazepam', 'valium'], classes: ['benzodiazepine', 'sedative'],
    purpose: 'Relieves anxiety, muscle spasm and seizures.', commonSideEffects: ['Drowsiness'], precautions: ['Can cause dependence.'] },
  { name: 'Clonazepam', aliases: ['clonazepam', 'rivotril', 'clonotril'], classes: ['benzodiazepine', 'sedative'],
    purpose: 'Treats seizures and panic disorder.', commonSideEffects: ['Drowsiness'], precautions: ['Can cause dependence.'] },

  // Allergy & breathing
  { name: 'Cetirizine', aliases: ['cetirizine', 'zyrtec', 'cetzine', 'okacet'], classes: ['antihistamine', 'sedative_mild'],
    purpose: 'Relieves allergy symptoms such as sneezing, runny nose and itchy eyes.', commonSideEffects: ['Drowsiness', 'Dry mouth'],
    precautions: ['May cause drowsiness — take care driving; avoid alcohol.'] },
  { name: 'Levocetirizine', aliases: ['levocetirizine', 'xyzal', 'levocet'], classes: ['antihistamine', 'sedative_mild'],
    purpose: 'Relieves allergy symptoms.', commonSideEffects: ['Drowsiness', 'Dry mouth'], precautions: ['May cause drowsiness.'] },
  { name: 'Montelukast', aliases: ['montelukast', 'singulair', 'montair'], classes: ['leukotriene_antagonist'],
    purpose: 'Prevents asthma and allergy symptoms.', commonSideEffects: ['Headache'], precautions: ['Report mood or sleep changes.'] },
  { name: 'Salbutamol', aliases: ['salbutamol', 'albuterol', 'asthalin', 'ventolin'], classes: ['beta_agonist'],
    purpose: 'Quick-relief inhaler that opens the airways during asthma symptoms.', commonSideEffects: ['Shakiness', 'Fast heartbeat'],
    precautions: ['If you need it more often than usual, see your doctor.'] },
  { name: 'Prednisolone', aliases: ['prednisolone', 'prednisone', 'wysolone'], classes: ['corticosteroid'],
    purpose: 'Reduces inflammation (asthma, allergies, autoimmune conditions).', commonSideEffects: ['Increased appetite', 'Mood changes', 'Raised blood sugar'],
    precautions: ['Do not stop a long course suddenly.'] },

  // Others
  { name: 'Methotrexate', aliases: ['methotrexate', 'folitrax'], classes: ['methotrexate'],
    purpose: 'Treats rheumatoid arthritis, psoriasis and some cancers.', commonSideEffects: ['Nausea', 'Mouth sores'],
    precautions: ['Usually taken ONCE A WEEK, not daily.', 'Needs regular blood tests.'] },
  { name: 'Allopurinol', aliases: ['allopurinol', 'zyloric'], classes: ['xanthine_oxidase_inhibitor'],
    purpose: 'Lowers uric acid to prevent gout attacks.', commonSideEffects: ['Rash'], precautions: ['Stop and seek advice if a rash appears.'] },
  { name: 'Azathioprine', aliases: ['azathioprine', 'imuran'], classes: ['thiopurine'],
    purpose: 'Suppresses the immune system in autoimmune conditions and transplants.', commonSideEffects: ['Nausea', 'Infections'], precautions: ['Needs regular blood tests.'] },
  { name: 'Theophylline', aliases: ['theophylline', 'deriphyllin'], classes: ['methylxanthine'],
    purpose: 'Opens the airways in asthma and COPD.', commonSideEffects: ['Nausea', 'Fast heartbeat'], precautions: ['Narrow safety margin.'] },
  { name: 'Iodinated contrast', aliases: ['contrast', 'iodinated contrast', 'contrast dye', 'ct contrast'], classes: ['contrast'],
    purpose: 'Dye used for some CT scans and X-ray procedures.', commonSideEffects: ['Warm feeling', 'Nausea'], precautions: ['Tell staff about kidney problems and diabetes medicines.'] }
];

export type Severity = 'high' | 'moderate' | 'low';

export interface InteractionRule {
  a: string; // drug name (lower-case) or "class:xyz"
  b: string;
  severity: Severity;
  description: string;
  advice: string;
}

export const INTERACTIONS: InteractionRule[] = [
  { a: 'class:anticoagulant', b: 'class:nsaid', severity: 'high', description: 'A blood thinner combined with an anti-inflammatory/aspirin greatly increases bleeding risk, including stomach bleeding.', advice: 'Avoid the combination unless a doctor specifically prescribed both; paracetamol is usually a safer painkiller. Watch for black stools or unusual bruising.' },
  { a: 'class:anticoagulant', b: 'class:antiplatelet', severity: 'high', description: 'Two blood-thinning medicines together increase bleeding risk.', advice: 'Only use together under close medical supervision.' },
  { a: 'warfarin', b: 'fluconazole', severity: 'high', description: 'Fluconazole strongly increases the effect of warfarin (higher INR) and bleeding risk.', advice: 'The prescriber should review; INR usually needs closer checks.' },
  { a: 'warfarin', b: 'metronidazole', severity: 'high', description: 'Metronidazole increases the effect of warfarin and bleeding risk.', advice: 'INR usually needs closer checks during the course.' },
  { a: 'warfarin', b: 'class:fluoroquinolone', severity: 'moderate', description: 'These antibiotics can increase the effect of warfarin.', advice: 'INR may need checking during the course.' },
  { a: 'warfarin', b: 'amiodarone', severity: 'high', description: 'Amiodarone increases warfarin levels and bleeding risk for weeks.', advice: 'Warfarin dose usually needs adjustment with close INR monitoring.' },
  { a: 'warfarin', b: 'class:macrolide', severity: 'moderate', description: 'Some macrolide antibiotics can increase the effect of warfarin.', advice: 'INR may need checking during the course.' },
  { a: 'clopidogrel', b: 'class:cyp2c19_inhibitor', severity: 'moderate', description: 'Omeprazole/esomeprazole can reduce how well clopidogrel works.', advice: 'Pantoprazole is often preferred if stomach protection is needed — ask the prescriber.' },
  { a: 'class:antiplatelet', b: 'class:nsaid', severity: 'moderate', description: 'Combining these increases stomach bleeding risk (and ibuprofen can blunt low-dose aspirin\'s protective effect).', advice: 'Discuss with the prescriber; stomach protection may be considered.' },
  { a: 'class:ssri', b: 'tramadol', severity: 'high', description: 'Risk of serotonin syndrome and seizures.', advice: 'Avoid unless prescribed together with monitoring; seek help for agitation, fever, tremor or confusion.' },
  { a: 'class:serotonergic', b: 'class:maoi_like', severity: 'high', description: 'Risk of serotonin syndrome, which can be life-threatening.', advice: 'This combination is generally avoided.' },
  { a: 'class:ssri', b: 'class:nsaid', severity: 'moderate', description: 'SSRIs with anti-inflammatories increase stomach bleeding risk.', advice: 'Stomach protection may be considered; watch for black stools.' },
  { a: 'class:ssri', b: 'class:anticoagulant', severity: 'moderate', description: 'Increased bleeding risk.', advice: 'Monitor for bleeding or bruising.' },
  { a: 'class:ace_inhibitor', b: 'class:potassium_sparing_diuretic', severity: 'high', description: 'Both raise potassium; together they can cause dangerously high potassium.', advice: 'Needs regular potassium and kidney blood tests.' },
  { a: 'class:arb', b: 'class:potassium_sparing_diuretic', severity: 'high', description: 'Both raise potassium; together they can cause dangerously high potassium.', advice: 'Needs regular potassium and kidney blood tests.' },
  { a: 'class:ace_inhibitor', b: 'class:potassium', severity: 'high', description: 'Potassium supplements with an ACE inhibitor can cause high potassium.', advice: 'Only combine with blood-test monitoring.' },
  { a: 'class:arb', b: 'class:potassium', severity: 'high', description: 'Potassium supplements with an ARB can cause high potassium.', advice: 'Only combine with blood-test monitoring.' },
  { a: 'class:potassium_sparing_diuretic', b: 'class:potassium', severity: 'high', description: 'Can cause dangerously high potassium.', advice: 'Usually avoided.' },
  { a: 'class:ace_inhibitor', b: 'class:arb', severity: 'moderate', description: 'Dual blockade raises the risk of kidney problems, low blood pressure and high potassium.', advice: 'Usually avoided; ask the prescriber.' },
  { a: 'class:ace_inhibitor', b: 'class:nsaid_analgesic', severity: 'moderate', description: 'Anti-inflammatories can reduce the blood-pressure effect and strain the kidneys.', advice: 'Use the lowest dose for the shortest time; kidney tests may be needed.' },
  { a: 'class:arb', b: 'class:nsaid_analgesic', severity: 'moderate', description: 'Anti-inflammatories can reduce the blood-pressure effect and strain the kidneys.', advice: 'Use the lowest dose for the shortest time.' },
  { a: 'simvastatin', b: 'class:strong_cyp3a4_inhibitor', severity: 'high', description: 'Clarithromycin/erythromycin sharply raise simvastatin levels, risking severe muscle damage.', advice: 'Simvastatin is usually paused during the antibiotic course.' },
  { a: 'atorvastatin', b: 'class:strong_cyp3a4_inhibitor', severity: 'moderate', description: 'Raises atorvastatin levels and muscle side-effect risk.', advice: 'Ask the prescriber whether to pause or lower the statin dose.' },
  { a: 'class:pde5_inhibitor', b: 'class:nitrate', severity: 'high', description: 'Can cause a sudden, dangerous drop in blood pressure.', advice: 'Never take these together.' },
  { a: 'digoxin', b: 'amiodarone', severity: 'high', description: 'Amiodarone raises digoxin levels (toxicity risk).', advice: 'Digoxin dose usually needs reducing with level checks.' },
  { a: 'digoxin', b: 'class:strong_cyp3a4_inhibitor', severity: 'moderate', description: 'Some macrolides can raise digoxin levels.', advice: 'Watch for nausea, vision changes or slow pulse.' },
  { a: 'methotrexate', b: 'class:nsaid', severity: 'high', description: 'Anti-inflammatories can increase methotrexate toxicity.', advice: 'Needs specialist advice and blood monitoring.' },
  { a: 'methotrexate', b: 'class:trimethoprim', severity: 'high', description: 'Co-trimoxazole can cause serious methotrexate toxicity (bone-marrow suppression).', advice: 'This combination is generally avoided.' },
  { a: 'lithium', b: 'class:nsaid_analgesic', severity: 'high', description: 'Anti-inflammatories can raise lithium to toxic levels.', advice: 'Avoid, or check lithium levels closely.' },
  { a: 'lithium', b: 'class:ace_inhibitor', severity: 'high', description: 'ACE inhibitors can raise lithium levels.', advice: 'Lithium levels need close monitoring.' },
  { a: 'lithium', b: 'class:thiazide', severity: 'high', description: 'Thiazide water tablets can raise lithium to toxic levels.', advice: 'Lithium levels need close monitoring.' },
  { a: 'class:fluoroquinolone', b: 'class:binder', severity: 'moderate', description: 'Antacids, calcium and iron block absorption of the antibiotic.', advice: 'Take the antibiotic 2 hours before or 6 hours after these products.' },
  { a: 'ciprofloxacin', b: 'theophylline', severity: 'high', description: 'Ciprofloxacin raises theophylline levels (risk of seizures and heart-rhythm problems).', advice: 'Usually avoided or monitored with levels.' },
  { a: 'levothyroxine', b: 'class:binder', severity: 'moderate', description: 'Calcium, iron and antacids reduce thyroid-tablet absorption.', advice: 'Separate them by at least 4 hours.' },
  { a: 'class:benzodiazepine', b: 'class:opioid', severity: 'high', description: 'Together they can dangerously slow breathing and cause heavy sedation.', advice: 'Avoid unless prescribed together with close supervision.' },
  { a: 'class:beta_blocker', b: 'class:rate_limiting_ccb', severity: 'high', description: 'Risk of a very slow heart rate and low blood pressure.', advice: 'Usually avoided; needs specialist review.' },
  { a: 'class:nonselective_beta_blocker', b: 'class:beta_agonist', severity: 'moderate', description: 'Propranolol can block the reliever inhaler and worsen asthma.', advice: 'People with asthma usually avoid non-selective beta-blockers.' },
  { a: 'allopurinol', b: 'azathioprine', severity: 'high', description: 'Allopurinol greatly increases azathioprine levels (bone-marrow toxicity).', advice: 'Needs a large azathioprine dose reduction or an alternative.' },
  { a: 'metformin', b: 'class:contrast', severity: 'moderate', description: 'Contrast dye can affect the kidneys; metformin may build up.', advice: 'Metformin is often paused around contrast scans — follow the radiology team\'s advice.' },
  { a: 'class:sedative_mild', b: 'class:sedative', severity: 'moderate', description: 'Extra drowsiness when combining an antihistamine with a sedative.', advice: 'Avoid driving; avoid alcohol.' },
  { a: 'class:sedative_mild', b: 'class:opioid', severity: 'moderate', description: 'Extra drowsiness.', advice: 'Avoid driving; avoid alcohol.' }
];

/** Allergy → drug classes/names that must be flagged. */
export const ALLERGY_RULES: Array<{ allergy: RegExp; targets: string[]; severity: Severity; note: string }> = [
  { allergy: /penicillin|amoxicillin|ampicillin|augmentin/i, targets: ['class:penicillin'], severity: 'high', note: 'This is a penicillin-type antibiotic and the patient reports a penicillin allergy.' },
  { allergy: /penicillin/i, targets: ['class:cephalosporin'], severity: 'moderate', note: 'Small chance of cross-reaction between penicillin and cephalosporin antibiotics.' },
  { allergy: /sulfa|sulpha|sulfonamide|sulphonamide/i, targets: ['class:sulfonamide'], severity: 'high', note: 'This antibiotic contains a sulfonamide and the patient reports a sulfa allergy.' },
  { allergy: /aspirin|nsaid|ibuprofen|diclofenac|naproxen/i, targets: ['class:nsaid'], severity: 'high', note: 'The patient reports an aspirin/NSAID allergy and this is an NSAID.' },
  { allergy: /macrolide|erythromycin|azithromycin|clarithromycin/i, targets: ['class:macrolide'], severity: 'high', note: 'The patient reports a macrolide antibiotic allergy.' },
  { allergy: /quinolone|ciprofloxacin|levofloxacin/i, targets: ['class:fluoroquinolone'], severity: 'high', note: 'The patient reports a fluoroquinolone allergy.' },
  { allergy: /codeine|morphine|opioid|opiate/i, targets: ['class:opioid'], severity: 'high', note: 'The patient reports an opioid allergy/intolerance.' },
  { allergy: /cephalosporin|cephalexin|ceftriaxone/i, targets: ['class:cephalosporin'], severity: 'high', note: 'The patient reports a cephalosporin allergy.' }
];

const normalise = (s: string): string =>
  s
    .toLowerCase()
    .replace(/\b\d+(\.\d+)?\s*(mg|mcg|µg|g|ml|iu|units?|%)\b/g, '')
    .replace(/\b(tab|tabs|tablet|tablets|cap|caps|capsule|capsules|syrup|inj|injection|inhaler|od|bd|tds|qid|sos|prn|once|twice|daily|hs)\b\.?/g, '')
    .replace(/[^a-z\s-]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

/** Maps free text like "Tab. Ecosprin 75mg OD" to a known drug. */
export const findDrug = (input: string): DrugInfo | null => {
  const n = normalise(input);
  if (!n) return null;
  // exact alias first, then alias contained as a whole word (longest alias wins)
  const exact = DRUGS.find((d) => d.aliases.includes(n));
  if (exact) return exact;
  let best: { drug: DrugInfo; len: number } | null = null;
  for (const d of DRUGS) {
    for (const a of d.aliases) {
      if (new RegExp(`\\b${a.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`).test(n) && (!best || a.length > best.len)) {
        best = { drug: d, len: a.length };
      }
    }
  }
  return best?.drug || null;
};

/** Finds every known drug mentioned anywhere in a report. */
export const findDrugsInText = (text: string): DrugInfo[] => {
  const lower = ` ${text.toLowerCase()} `;
  const found = new Map<string, DrugInfo>();
  for (const d of DRUGS) {
    if (d.classes.includes('contrast')) continue; // "contrast" is too common a word in reports
    for (const a of d.aliases) {
      if (a.length < 4 && a !== 'pan') continue;
      if (a === 'pan' || a === 'calcium' || a === 'iron' || a === 'insulin' || a === 'lithium') {
        // ambiguous words — only count when followed by a dose or preceded by Tab/Cap/Inj
        const re = new RegExp(`\\b(?:tab\\.?|cap\\.?|inj\\.?)\\s*${a}\\b|\\b${a}\\s*\\d+\\s*(?:mg|mcg|iu|units)\\b(?!\\s*\\/)`, 'i');
        if (re.test(text)) found.set(d.name, d);
        continue;
      }
      if (new RegExp(`\\b${a.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`).test(lower)) {
        found.set(d.name, d);
        break;
      }
    }
  }
  return [...found.values()];
};

const matches = (drug: DrugInfo, token: string): boolean =>
  token.startsWith('class:') ? drug.classes.includes(token.slice(6)) : drug.name.toLowerCase() === token;

export interface InteractionAlert {
  severity: Severity;
  drugs: string[];
  description: string;
  actionableAdvice: string;
  kind: 'interaction' | 'duplicate' | 'allergy';
}

const DUPLICATE_CLASSES: Record<string, string> = {
  nsaid: 'two anti-inflammatory painkillers (NSAIDs)',
  ssri: 'two SSRI antidepressants',
  statin: 'two statins',
  ppi: 'two stomach-acid (PPI) medicines',
  benzodiazepine: 'two benzodiazepine sedatives',
  ace_inhibitor: 'two ACE inhibitors',
  arb: 'two ARB blood-pressure medicines',
  beta_blocker: 'two beta-blockers',
  anticoagulant: 'two anticoagulants',
  opioid: 'two opioid painkillers',
  antihistamine: 'two antihistamines'
};

export const checkInteractions = (
  inputs: string[],
  allergies: string[] = []
): { recognised: DrugInfo[]; unrecognised: string[]; alerts: InteractionAlert[] } => {
  const recognised: DrugInfo[] = [];
  const unrecognised: string[] = [];
  for (const raw of inputs) {
    const d = findDrug(raw);
    if (d) {
      if (!recognised.some((r) => r.name === d.name)) recognised.push(d);
    } else if (raw.trim()) {
      unrecognised.push(raw.trim());
    }
  }

  const alerts: InteractionAlert[] = [];
  const sevRank: Record<Severity, number> = { high: 0, moderate: 1, low: 2 };
  for (let i = 0; i < recognised.length; i++) {
    for (let j = i + 1; j < recognised.length; j++) {
      const x = recognised[i];
      const y = recognised[j];
      // one alert per drug pair: the most severe matching rule (rules are listed most-important first)
      let best: InteractionRule | null = null;
      for (const rule of INTERACTIONS) {
        const hit = (matches(x, rule.a) && matches(y, rule.b)) || (matches(y, rule.a) && matches(x, rule.b));
        if (hit && (!best || sevRank[rule.severity] < sevRank[best.severity])) best = rule;
      }
      if (best) {
        alerts.push({ severity: best.severity, drugs: [x.name, y.name], description: best.description, actionableAdvice: best.advice, kind: 'interaction' });
        continue;
      }
      for (const [cls, label] of Object.entries(DUPLICATE_CLASSES)) {
        if (x.classes.includes(cls) && y.classes.includes(cls)) {
          alerts.push({
            severity: 'moderate',
            drugs: [x.name, y.name],
            description: `Duplicate therapy: ${label} at the same time.`,
            actionableAdvice: 'Check with the prescriber whether both are intended.',
            kind: 'duplicate'
          });
          break;
        }
      }
    }
  }

  for (const allergy of allergies.filter(Boolean)) {
    for (const rule of ALLERGY_RULES) {
      if (!rule.allergy.test(allergy)) continue;
      for (const d of recognised) {
        if (rule.targets.some((t) => matches(d, t))) {
          alerts.push({
            severity: rule.severity,
            drugs: [d.name],
            description: `Allergy warning (${allergy}): ${rule.note}`,
            actionableAdvice: 'Do not take it until the prescriber has confirmed it is safe.',
            kind: 'allergy'
          });
        }
      }
    }
  }

  const order: Record<Severity, number> = { high: 0, moderate: 1, low: 2 };
  alerts.sort((a, b) => order[a.severity] - order[b.severity]);
  return { recognised, unrecognised, alerts };
};
