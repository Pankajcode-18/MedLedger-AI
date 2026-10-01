"""Phase 11 – printable study forms (English, Nepali, Hindi) → study_forms.html and study_forms.pdf.
Run: python3 docs/study/forms/build_forms.py   (needs Chromium and a Devanagari font such as Noto Sans Devanagari)
The Nepali and Hindi texts are careful draft translations: have a native speaker check them (ideally by
back-translation) before the study, and note in the paper that the SUS translations were not formally validated."""
import os, subprocess, html
HERE = os.path.dirname(os.path.abspath(__file__))

SUS = {
 'en': ['I think that I would like to use MedLedger frequently.',
        'I found MedLedger unnecessarily complex.',
        'I thought MedLedger was easy to use.',
        'I think that I would need the support of a technical person to be able to use MedLedger.',
        'I found the various functions in MedLedger were well integrated.',
        'I thought there was too much inconsistency in MedLedger.',
        'I would imagine that most people would learn to use MedLedger very quickly.',
        'I found MedLedger very cumbersome to use.',
        'I felt very confident using MedLedger.',
        'I needed to learn a lot of things before I could get going with MedLedger.'],
 'ne': ['मलाई लाग्छ, म MedLedger बारम्बार प्रयोग गर्न चाहन्छु।',
        'मलाई MedLedger अनावश्यक रूपमा जटिल लाग्यो।',
        'मलाई MedLedger प्रयोग गर्न सजिलो लाग्यो।',
        'मलाई लाग्छ, MedLedger प्रयोग गर्न मलाई कुनै प्राविधिक व्यक्तिको सहयोग चाहिन्छ।',
        'मलाई MedLedger का विभिन्न सुविधाहरू राम्रोसँग मिलेर काम गर्ने लाग्यो।',
        'मलाई MedLedger मा धेरै असङ्गति (एकरूपताको कमी) भएको लाग्यो।',
        'मेरो अनुमानमा धेरैजसो मानिसले MedLedger चाँडै प्रयोग गर्न सिक्नेछन्।',
        'मलाई MedLedger प्रयोग गर्न निकै झन्झटिलो लाग्यो।',
        'MedLedger प्रयोग गर्दा म पूर्ण आत्मविश्वासी थिएँ।',
        'MedLedger प्रयोग गर्न सुरु गर्नुअघि मैले धेरै कुरा सिक्नुपर्‍यो।'],
 'hi': ['मुझे लगता है कि मैं MedLedger का बार-बार उपयोग करना चाहूँगा/चाहूँगी।',
        'मुझे MedLedger बेवजह जटिल लगा।',
        'मुझे MedLedger उपयोग करने में आसान लगा।',
        'मुझे लगता है कि MedLedger का उपयोग करने के लिए मुझे किसी तकनीकी व्यक्ति की मदद की ज़रूरत होगी।',
        'मुझे लगा कि MedLedger के अलग-अलग काम अच्छी तरह से एक साथ जुड़े हुए हैं।',
        'मुझे लगा कि MedLedger में बहुत ज़्यादा असंगति (एकरूपता की कमी) है।',
        'मेरा अनुमान है कि ज़्यादातर लोग MedLedger का उपयोग बहुत जल्दी सीख जाएँगे।',
        'मुझे MedLedger का उपयोग करना बहुत झंझट भरा लगा।',
        'MedLedger का उपयोग करते समय मुझे पूरा आत्मविश्वास था।',
        'MedLedger का उपयोग शुरू करने से पहले मुझे बहुत सी बातें सीखनी पड़ीं।'],
}
SCALE = {'en': ['Strongly disagree', 'Disagree', 'Neutral', 'Agree', 'Strongly agree'],
         'ne': ['पूर्ण असहमत', 'असहमत', 'न सहमत न असहमत', 'सहमत', 'पूर्ण सहमत'],
         'hi': ['पूरी तरह असहमत', 'असहमत', 'न सहमत न असहमत', 'सहमत', 'पूरी तरह सहमत']}
T = {
 'en': dict(lang='English', sus_title='Questionnaire (System Usability Scale)', sus_intro='Tick one box for each statement. Answer quickly, with your first reaction. If a statement does not apply, tick the middle box.',
   pid='Participant ID', date='Date',
   consent_title='Information and consent',
   consent=['You are invited to try MedLedger, a website that keeps medical reports safe and explains them in simple language. The study is part of a university research project.',
            'You will do a few short tasks on a phone or computer (upload a sample report, share it with a doctor, stop sharing, read the explanation) while a researcher watches, and then fill in a short questionnaire. It takes about 30 minutes.',
            'You will use a test account and a made-up sample report. Please do not enter any real medical information.',
            'Taking part is your choice. You can stop at any time without giving a reason, and your answers will then be deleted.',
            'We record only your participant number, age group, the tasks you completed, the time taken and your answers. We do not record your name with your answers. Results are published only as totals.',
            'If you have questions, ask the researcher now or contact: ______________________'],
   agree='I have read (or had read to me) this information, my questions were answered, and I agree to take part.',
   sign='Signature or thumbprint', name='Name (kept separately from the answers)', researcher='Researcher',
   tasks_title='Tasks', tasks_intro='Please do these tasks one at a time. Think aloud if you like. The researcher will not help unless you ask.',
   tasks=['Sign in with the test account on your card.',
          'Upload the sample report (take a photo of the printed sheet, or choose the file the researcher gives you).',
          'Open the report and read the explanation. Then tell the researcher: which values are outside the normal range?',
          'Share your records with Dr. Anil Sharma.',
          'Stop sharing with Dr. Anil Sharma.',
          'Find where you can see who has opened your records.']),
 'ne': dict(lang='नेपाली', sus_title='प्रश्नावली (प्रणाली प्रयोगयोग्यता मापन – SUS)', sus_intro='हरेक भनाइका लागि एउटा कोठामा चिन्ह लगाउनुहोस्। धेरै नसोची पहिलो प्रतिक्रिया दिनुहोस्। कुनै भनाइ लागू नहुने भए बीचको कोठामा चिन्ह लगाउनुहोस्।',
   pid='सहभागी नम्बर', date='मिति',
   consent_title='जानकारी र सहमति',
   consent=['तपाईंलाई MedLedger प्रयोग गरेर हेर्न आमन्त्रण गरिन्छ। यो वेबसाइटले मेडिकल रिपोर्टहरू सुरक्षित राख्छ र सजिलो भाषामा बुझाउँछ। यो अध्ययन विश्वविद्यालयको अनुसन्धान परियोजनाको भाग हो।',
            'तपाईंले फोन वा कम्प्युटरमा केही छोटा काम गर्नुहुनेछ (नमुना रिपोर्ट अपलोड गर्ने, डाक्टरसँग सेयर गर्ने, सेयर बन्द गर्ने, व्याख्या पढ्ने)। अनुसन्धानकर्ताले हेर्नुहुनेछ, त्यसपछि तपाईंले छोटो प्रश्नावली भर्नुहुनेछ। यसमा करिब ३० मिनेट लाग्छ।',
            'तपाईंले परीक्षण खाता र काल्पनिक नमुना रिपोर्ट प्रयोग गर्नुहुनेछ। कृपया कुनै वास्तविक स्वास्थ्य जानकारी नहाल्नुहोस्।',
            'सहभागी हुने वा नहुने तपाईंको इच्छा हो। तपाईं कुनै पनि बेला कारण नबताई रोक्न सक्नुहुन्छ, र तपाईंका उत्तरहरू मेटाइनेछन्।',
            'हामी तपाईंको सहभागी नम्बर, उमेर समूह, पूरा गरिएका काम, लागेको समय र उत्तर मात्र राख्छौं। तपाईंको नाम उत्तरसँग राखिँदैन। नतिजा कुल सङ्ख्याका रूपमा मात्र प्रकाशित हुन्छ।',
            'प्रश्न भए अहिले अनुसन्धानकर्तालाई सोध्नुहोस् वा सम्पर्क गर्नुहोस्: ______________________'],
   agree='मैले यो जानकारी पढेँ (वा मलाई पढेर सुनाइयो), मेरा प्रश्नहरूको उत्तर पाएँ, र म सहभागी हुन सहमत छु।',
   sign='हस्ताक्षर वा औँठाछाप', name='नाम (उत्तरभन्दा छुट्टै राखिन्छ)', researcher='अनुसन्धानकर्ता',
   tasks_title='कामहरू', tasks_intro='कृपया यी काम एक-एक गरी गर्नुहोस्। चाहनुहुन्छ भने सोचेको कुरा बोल्दै गर्नुहोस्। तपाईंले नमागेसम्म अनुसन्धानकर्ताले मद्दत गर्नुहुने छैन।',
   tasks=['कार्डमा दिइएको परीक्षण खाताबाट साइन इन गर्नुहोस्।',
          'नमुना रिपोर्ट अपलोड गर्नुहोस् (छापिएको पानाको फोटो खिच्नुहोस्, वा अनुसन्धानकर्ताले दिएको फाइल छान्नुहोस्)।',
          'रिपोर्ट खोलेर व्याख्या पढ्नुहोस्। त्यसपछि अनुसन्धानकर्तालाई भन्नुहोस्: कुन-कुन मान सामान्य सीमाभन्दा बाहिर छन्?',
          'आफ्ना रेकर्डहरू डा. अनिल शर्मासँग सेयर गर्नुहोस्।',
          'डा. अनिल शर्मासँग सेयर गर्न बन्द गर्नुहोस्।',
          'तपाईंका रेकर्ड कसले खोलेको छ भनेर कहाँ हेर्न सकिन्छ, पत्ता लगाउनुहोस्।']),
 'hi': dict(lang='हिन्दी', sus_title='प्रश्नावली (सिस्टम उपयोगिता पैमाना – SUS)', sus_intro='हर कथन के लिए एक बॉक्स पर निशान लगाएँ। ज़्यादा न सोचें, पहली प्रतिक्रिया दें। अगर कोई कथन लागू न हो तो बीच वाले बॉक्स पर निशान लगाएँ।',
   pid='प्रतिभागी संख्या', date='तारीख',
   consent_title='जानकारी और सहमति',
   consent=['आपको MedLedger आज़माने के लिए आमंत्रित किया जाता है। यह वेबसाइट मेडिकल रिपोर्ट सुरक्षित रखती है और उन्हें आसान भाषा में समझाती है। यह अध्ययन एक विश्वविद्यालय के शोध प्रोजेक्ट का हिस्सा है।',
            'आप फ़ोन या कंप्यूटर पर कुछ छोटे काम करेंगे (नमूना रिपोर्ट अपलोड करना, डॉक्टर के साथ साझा करना, साझा करना बंद करना, व्याख्या पढ़ना)। शोधकर्ता देखेंगे, फिर आप एक छोटी प्रश्नावली भरेंगे। इसमें लगभग 30 मिनट लगते हैं।',
            'आप एक परीक्षण खाते और एक काल्पनिक नमूना रिपोर्ट का उपयोग करेंगे। कृपया कोई असली स्वास्थ्य जानकारी न डालें।',
            'भाग लेना आपकी इच्छा है। आप किसी भी समय बिना कारण बताए रुक सकते हैं, और तब आपके उत्तर मिटा दिए जाएँगे।',
            'हम केवल आपकी प्रतिभागी संख्या, आयु वर्ग, पूरे किए गए काम, लगा समय और आपके उत्तर रखते हैं। आपका नाम उत्तरों के साथ नहीं रखा जाता। परिणाम केवल कुल संख्या के रूप में प्रकाशित होते हैं।',
            'कोई प्रश्न हो तो अभी शोधकर्ता से पूछें या संपर्क करें: ______________________'],
   agree='मैंने यह जानकारी पढ़ी है (या मुझे पढ़कर सुनाई गई है), मेरे प्रश्नों के उत्तर मिल गए हैं, और मैं भाग लेने के लिए सहमत हूँ।',
   sign='हस्ताक्षर या अँगूठे का निशान', name='नाम (उत्तरों से अलग रखा जाता है)', researcher='शोधकर्ता',
   tasks_title='काम', tasks_intro='कृपया ये काम एक-एक करके करें। चाहें तो सोचते हुए बोलते रहें। जब तक आप न माँगें, शोधकर्ता मदद नहीं करेंगे।',
   tasks=['अपने कार्ड पर दिए परीक्षण खाते से साइन इन करें।',
          'नमूना रिपोर्ट अपलोड करें (छपे हुए पन्ने की फ़ोटो लें, या शोधकर्ता की दी हुई फ़ाइल चुनें)।',
          'रिपोर्ट खोलकर व्याख्या पढ़ें। फिर शोधकर्ता को बताएँ: कौन-से मान सामान्य सीमा से बाहर हैं?',
          'अपने रिकॉर्ड डॉ. अनिल शर्मा के साथ साझा करें।',
          'डॉ. अनिल शर्मा के साथ साझा करना बंद करें।',
          'पता लगाएँ कि आपके रिकॉर्ड किसने खोले, यह कहाँ देखा जा सकता है।']),
}
CLIN_TASKS = ['Sign in with the clinician test account.',
              'Find the patient who shared records with you and open the newest report.',
              'Read the AI summary. Which values does it flag, and do you agree with them?',
              'Ask a second patient (on your card) for access to their records.',
              'Check a report’s fingerprint (the “Check” button) and say whether the file is unchanged.']
TASK_IDS = ['sign_in', 'upload', 'read_summary', 'share', 'stop_sharing', 'find_activity']
CLIN_IDS = ['sign_in', 'open_shared', 'read_summary', 'request_access', 'verify_record']

e = html.escape
def header(lang, title):
    t = T[lang]
    return f'<div class="hdr"><span>MedLedger study · {e(t["lang"])}</span><span>{e(t["pid"])}: ________ &nbsp; {e(t["date"])}: ____________</span></div><h1>{e(title)}</h1>'

pages = []
pages.append('''<section class="page cover"><h1>MedLedger AI – study forms</h1>
<p>Printable forms for Phase 11. Print one set per participant in the language they choose.</p>
<ol><li>Information and consent – English, Nepali, Hindi</li><li>Patient task sheet – English, Nepali, Hindi</li><li>Clinician task sheet – English</li>
<li>Sample report for the tasks (fictional)</li><li>Questionnaire (SUS) – English, Nepali, Hindi</li><li>Observer's task log</li><li>Checklist for collecting real reports</li></ol>
<p class="warn">The Nepali and Hindi texts are draft translations. Before the study, have a native speaker check them, ideally by translating them back into English and comparing. Enter results in the CSV files under <b>docs/study/templates</b> (copied to <b>docs/study/data</b>).</p>
<p>SUS items: J. Brooke, “SUS: a quick and dirty usability scale,” 1996 (“system” replaced by “MedLedger”).</p></section>''')
for lang in ['en', 'ne', 'hi']:
    t = T[lang]
    pages.append(f'<section class="page" lang="{lang}">{header(lang, t["consent_title"])}' + ''.join(f'<p>{e(p)}</p>' for p in t['consent']) +
                 f'<p class="box">☐ {e(t["agree"])}</p><table class="sign"><tr><td>{e(t["sign"])}</td><td></td></tr><tr><td>{e(t["name"])}</td><td></td></tr><tr><td>{e(t["researcher"])}</td><td></td></tr><tr><td>{e(t["date"])}</td><td></td></tr></table></section>')
for lang in ['en', 'ne', 'hi']:
    t = T[lang]
    pages.append(f'<section class="page" lang="{lang}">{header(lang, t["tasks_title"])}<p>{e(t["tasks_intro"])}</p><ol class="tasks">' + ''.join(f'<li>{e(x)}</li>' for x in t['tasks']) + '</ol></section>')
pages.append(f'<section class="page" lang="en">{header("en", "Tasks (clinicians)")}<p>Please do these tasks one at a time. Think aloud if you like.</p><ol class="tasks">' + ''.join(f'<li>{e(x)}</li>' for x in CLIN_TASKS) + '</ol></section>')
pages.append('''<section class="page sample"><div class="stamp">SAMPLE – FICTIONAL PATIENT – FOR THE STUDY ONLY</div>
<h2>City Diagnostic Laboratory</h2><p>Patient Name: Sita Example &nbsp;&nbsp; Age/Sex: 42/F &nbsp;&nbsp; Collected: 12/10/2026<br>Referred by: Dr. Anil Sharma</p>
<table class="lab"><tr><th>Test</th><th>Result</th><th>Unit</th><th>Reference</th></tr>
<tr><td>Haemoglobin</td><td>10.9</td><td>g/dL</td><td>12.0 – 15.5</td></tr><tr><td>Fasting blood sugar</td><td>131</td><td>mg/dL</td><td>70 – 100</td></tr>
<tr><td>HbA1c</td><td>6.9</td><td>%</td><td>&lt; 5.7</td></tr><tr><td>Total cholesterol</td><td>182</td><td>mg/dL</td><td>&lt; 200</td></tr>
<tr><td>Serum creatinine</td><td>0.8</td><td>mg/dL</td><td>0.6 – 1.1</td></tr><tr><td>TSH</td><td>2.1</td><td>µIU/mL</td><td>0.4 – 4.0</td></tr></table>
<p>Impression: Anaemia and raised blood sugar. Please review with the referring doctor.</p><p>Reported by: Dr. R. Example, Pathologist</p>
<p class="key">Answer key for task 3 (researcher only): haemoglobin low; fasting sugar and HbA1c high; the other three normal.</p></section>''')
for lang in ['en', 'ne', 'hi']:
    t = T[lang]; sc = SCALE[lang]
    rows = ''.join(f'<tr><td class="n">{i+1}</td><td class="q">{e(q)}</td>' + ''.join('<td class="c">☐</td>' for _ in range(5)) + '</tr>' for i, q in enumerate(SUS[lang]))
    pages.append(f'<section class="page" lang="{lang}">{header(lang, t["sus_title"])}<p>{e(t["sus_intro"])}</p><table class="sus"><colgroup><col style="width:5%"><col style="width:45%">' + '<col style="width:10%">' * 5 + '</colgroup><tr><th></th><th></th>' +
                 ''.join(f'<th>{i+1}<br><small>{e(s)}</small></th>' for i, s in enumerate(sc)) + f'</tr>{rows}</table><p>Comments / टिप्पणी / टिप्पणी:</p><div class="lines"></div></section>')
log_rows = ''.join(f'<tr><td>{x}</td><td>☐ yes ☐ assisted ☐ no</td><td></td><td></td><td></td><td></td></tr>' for x in TASK_IDS)
clin_rows = ''.join(f'<tr><td>{x}</td><td>☐ yes ☐ assisted ☐ no</td><td></td><td></td><td></td><td></td></tr>' for x in CLIN_IDS)
pages.append(f'''<section class="page" lang="en">{header("en", "Observer's task log")}<p>Role: ☐ patient ☐ clinician &nbsp; Language: ☐ en ☐ ne ☐ hi &nbsp; Age band: ☐ 18–29 ☐ 30–44 ☐ 45–59 ☐ 60+ &nbsp; Uses a smartphone daily: ☐ yes ☐ no</p>
<p>Start the stopwatch when the participant starts reading the task; stop when it is done or after 5 minutes (then “no”). “Assisted” = needed any hint. Errors = wrong screens or dead ends. For read_summary, note whether the answer was correct.</p>
<h3>Patient tasks</h3><table class="log"><tr><th>task</th><th>completed</th><th>seconds</th><th>errors</th><th>correct answer?</th><th>notes</th></tr>{log_rows}</table>
<h3>Clinician tasks</h3><table class="log"><tr><th>task</th><th>completed</th><th>seconds</th><th>errors</th><th>correct answer?</th><th>notes</th></tr>{clin_rows}</table></section>''')
pages.append('''<section class="page" lang="en"><h1>Checklist for collecting real reports</h1><ol class="check">
<li>Written approval from your guide / the institution's ethics committee, and written permission from each partner laboratory.</li>
<li>Collect 50–100 reports: at least 30 printed (scanned or photographed flat), at least 20 phone photos, and any digital PDFs. Mix laboratories and test panels.</li>
<li><b>Anonymise before the files leave the laboratory:</b> black out (on paper, then photograph) or crop the patient name, relatives, phone, address, ID numbers, dates of birth, barcodes/QR codes, and doctors' names and signatures. Keep ages and sex.</li>
<li>Name the files R001, R002 … (no names in file names) and put them in <b>docs/study/data/reports/</b>. Never commit them to a public repository.</li>
<li>Label every printed value in <b>labels.csv</b> exactly as printed (name, value, unit, range, H/L flag). A second person checks 10% of the rows.</li>
<li>Run <b>eval_real_reports.ts</b>. If it reports possible personal details, check those files again.</li>
<li>Build the review pack (<b>make_review_pack.ts</b>) and give it to two doctors separately.</li></ol></section>''')

CSS = '''@page{size:A4;margin:16mm} body{font-family:"Noto Sans","Noto Sans Devanagari",sans-serif;font-size:11.5pt;color:#0b1220;line-height:1.5}
.page{page-break-after:always} .hdr{display:flex;justify-content:space-between;font-size:9pt;color:#475569;border-bottom:1px solid #cbd5e1;padding-bottom:4px;margin-bottom:10px}
h1{font-size:17pt;margin:6px 0 10px} .box{border:1px solid #0b1220;padding:8px;margin-top:14px} table{border-collapse:collapse;width:100%}
.sign td{border-bottom:1px solid #94a3b8;height:34px;padding:4px} .sign td:first-child{width:40%;color:#475569}
.tasks li{margin:0 0 16px} .sus{table-layout:fixed} .sus th{font-size:8.5pt;font-weight:normal;text-align:center;border:1px solid #cbd5e1;padding:3px}
.sus td{border:1px solid #cbd5e1;padding:5px 6px} .sus td.c{text-align:center;font-size:15pt} .sus td.n{width:4%;text-align:center}
.lines{border-bottom:1px solid #94a3b8;height:26px;margin-bottom:6px} .log th,.log td{border:1px solid #cbd5e1;padding:6px;font-size:10pt;height:22px}
.lab th,.lab td{border:1px solid #94a3b8;padding:6px} .stamp{border:2px solid #b91c1c;color:#b91c1c;font-weight:bold;text-align:center;padding:6px;margin-bottom:14px}
.key{margin-top:40px;font-size:9pt;color:#475569;border-top:1px dashed #94a3b8;padding-top:6px} .warn{background:#fff7ed;border:1px solid #fdba74;padding:8px}
.check li{margin-bottom:10px}'''
doc = f'<!doctype html><html><head><meta charset="utf-8"><title>MedLedger study forms</title><style>{CSS}</style></head><body>{"".join(pages)}</body></html>'
open(os.path.join(HERE, 'study_forms.html'), 'w').write(doc)
chrome = next((p for p in ['/opt/pw-browsers/chromium-1194/chrome-linux/chrome', 'chromium', 'chromium-browser', 'google-chrome'] if os.path.exists(p) or subprocess.run(['which', p], capture_output=True).returncode == 0), None)
subprocess.run([chrome, '--headless', '--no-sandbox', '--disable-gpu', f'--print-to-pdf={os.path.join(HERE, "study_forms.pdf")}', '--no-pdf-header-footer', 'file://' + os.path.join(HERE, 'study_forms.html')], check=True, capture_output=True)
print('wrote study_forms.html and study_forms.pdf')
