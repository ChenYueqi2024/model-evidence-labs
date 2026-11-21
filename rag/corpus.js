// Fictional institute and manuals. Verbatim spans below are the annotation targets.
export const documents = [
  {id:'current', title:'Mirror Lab policy · October 2026', text:
    'The current Mirror Lab loan period for a portable spectrometer is seven calendar days. The October 2026 policy replaces the archived January policy.\n\n' +
    'Renewals must be requested two working days before the due date. Staff only approve a renewal if the instrument has no pending reservation.'},
  {id:'archive', title:'Mirror Lab policy · January 2025 (archived)', text:
    'Archived Mirror Lab loan policy: the portable spectrometer loan period was fourteen calendar days. This January 2025 policy is retained for historical reference.\n\n' +
    'The old renewal process accepted forms on the due date. Do not use the archived process for current loans.'},
  {id:'training', title:'Optics workshop guide', text:
    'A laser alignment workshop requires a current Beam Safety certificate. Beginners can attend the introductory sequence after certificate verification.\n\n' +
    'The workshop uses a tabletop optical bench. Spare mirrors are kept in the preparation room.'},
  {id:'exam', title:'Beam Safety certificate handbook', text:
    'The Beam Safety certificate requires a practical exam. The practical exam takes 45 minutes.\n\n' +
    'Course notes cover beam stops and supervised alignment. The written self-check is optional.'},
  {id:'room', title:'Sample processing handbook', text:
    'Samples should be stored in cabinet C3 overnight. Record the specimen ID and collection time in the sample log.\n\n' +
    'Wet samples should be placed in a labelled secondary container. The cabinet is in the preparation room.'},
  {id:'demo', title:'Magazine · Introducing the Aurora instruments', text:
    'The portable spectrometer is a compact instrument and a popular loan item. The display follows a tour of student projects, gallery exhibits and mirror experiments.\n\n' +
    'Spectrometer loan period is a common topic at our summer showcase. Ask the lab team about the current policy, renewal and calendar deadlines.'}
];

function evidence(id, text) { return {id, text}; }

export const tasks = [
  {id:'loan', label:'现行期限', query:'What is the current loan period for the portable spectrometer?',
    expected:[evidence('current','The current Mirror Lab loan period for a portable spectrometer is seven calendar days.')],
    answer:'现行借期为 7 个自然日。', timeline:true},
  {id:'renew', label:'续借条件', query:'When must I request a renewal, and what condition must be satisfied?',
    expected:[evidence('current','Renewals must be requested two working days before the due date.'), evidence('current','Staff only approve a renewal if the instrument has no pending reservation.')],
    answer:'须提前两个工作日提出续借申请，且仪器没有待处理的预约。'},
  {id:'hop', label:'跨文档找证据', query:'What certificate is needed for laser alignment workshop and how long is its practical exam?',
    expected:[evidence('training','A laser alignment workshop requires a current Beam Safety certificate.'), evidence('exam','The practical exam takes 45 minutes.')],
    answer:'需要有效的 Beam Safety 证书，该证书的实操考试用时 45 分钟。'},
  {id:'sample', label:'同义词查询', query:'Where should specimens be kept overnight?',
    expected:[evidence('room','Samples should be stored in cabinet C3 overnight.')],
    answer:'样本应在 C3 柜隔夜存放。'},
  {id:'missing', label:'没有答案', query:'What is the serial number of the portable spectrometer?',
    expected:[], answer:''}
];

export const aliases = {
  specimen:['sample','samples'], specimens:['sample','samples'], samples:['sample'], kept:['stored'], duration:['minutes','period'],
  borrow:['loan'], borrowing:['loan'], renewals:['renewal'], renew:['renewal'],
};
