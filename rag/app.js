import {documents, tasks} from './corpus.js';
import {chunksOf, rank, chooseContext, evidenceCoverage, promptFor, tokens} from './engine.js';
import {find} from '../ui.js';

const config = {
  expectedInputs:[{type:'text', languages:['en']}],
  expectedOutputs:[{type:'text', languages:['en'] }]
};
const excluded = new Set();
let query = '', task, ranked = [], version = 0, modelState = 'unavailable', running = false;

function element(tag, text, className) {
  const node = document.createElement(tag);
  if (text) node.textContent = text;
  if (className) node.className = className;
  return node;
}
const appendix = () => ({id:'custom',title:'自选文档',text:find('custom').value.trim()});
function options() {
  return {mode:find('chunks').value, method:find('ranker').value, expand:find('expand').checked,
    top:Number(find('top').value), budget:Number(find('budget').value)};
}

function listSources(chunks) {
  const list = element('ul');
  for (const chunk of chunks) {
    const link = element('a','['+chunk.id+'] '+chunk.title);
    link.href = '#chunk-'+chunk.id;
    const item = element('li');
    item.append(link);
    list.append(item);
  }
  find('citations').replaceChildren(...(chunks.length ? [list] : []));
}

function answerFrom(context) {
  let answer = '', sources = [];
  if (task) {
    const evidence = evidenceCoverage(context,task);
    const support = evidence.filter(Boolean);
    sources = Array.from(new Set(support));
    if (evidence.length && support.length === evidence.length) answer = task.answer;
    else if (task.timeline && context.some(chunk => chunk.doc === 'archive')) {
      answer = '当前上下文有旧规，现行期限的证据没有进入上下文，因此暂不回答。';
    } else if (support.length) {
      answer = '只找到 ' + support.length + ' / ' + evidence.length + ' 条关键证据，暂不拼成完整回答。';
    } else {
      answer = '证据不足，暂不回答。检索到包含相同词的段落，仍可能缺少所问事实。';
    }
  } else if (context.length) {
    const terms = new Set(tokens(query));
    let best = {count:0};
    for (const source of context) {
      for (const sentence of chunksOf([{...source,id:source.doc}], 'sentence')) {
        const count = new Set(sentence.words.filter(term => terms.has(term))).size;
        if (count > best.count) best = {count, sentence:sentence.text, source};
      }
    }
    if (best.source) {
      answer = '关键词重合最多的原句（请核对是否回答了问题）：“' + best.sentence + '”';
      sources = [best.source];
    }
  }
  find('answer').textContent = answer || '未找到适合展示的证据。';
  listSources(sources);
}

function renderChunks(candidates) {
  const oldFocus = document.activeElement?.id;
  const articles = candidates.map((chunk,index) => {
    const article = element('article','','rag-chunk '+chunk.status);
    article.id='chunk-'+chunk.id;
    const title = element('div','','section-head');
    const inclusion = {included:'进入上下文', removed:'手动移除', budget:'超过预算'};
    title.append(element('h3','#'+(index+1)+' · '+chunk.title), element('span',inclusion[chunk.status],'rag-tag'));
    const body = element('blockquote');
    const splitter = new Intl.Segmenter('zh',{granularity:'word'});
    const hits = new Set(chunk.hits);
    for (const word of splitter.segment(chunk.text)) {
      if (hits.has(word.segment.toLowerCase())) body.append(element('mark',word.segment));
      else body.append(document.createTextNode(word.segment));
    }
    const note = element('p','['+chunk.id+'] · '+chunk.count+' 字符 · 得分 '+chunk.score.toFixed(2),'rag-meta');
    const label = element('label','');
    const check = element('input');
    check.type='checkbox';
    check.id='keep-'+chunk.id;
    check.checked=!excluded.has(chunk.id);
    check.onchange = () => {
      if (check.checked) excluded.delete(chunk.id);
      else excluded.add(chunk.id);
      updateAnswer();
    };
    label.append(check,' 允许此段进入上下文');
    article.append(title,note,body,label);
    return article;
  });
  if (!articles.length) articles.push(element('p','没有匹配段落。可以换词、添加资料或试试展开同义词。'));
  find('retrieved').replaceChildren(...articles);
  if (oldFocus?.startsWith('keep-')) find(oldFocus)?.focus({preventScroll:true});
}

function updateAnswer() {
  const {top,budget} = options();
  const {candidates, used, context} = chooseContext(ranked,top,budget,excluded);
  version++;
  find('generated').hidden = true;
  find('prompt').textContent = promptFor(query,context);
  find('pipeline').textContent = '匹配到 '+ranked.length+' 块 → 检查前 '+candidates.length+
    ' 块 → 保留 '+context.length+' 块 · '+used+' / '+budget+' 个正文字符';
  renderChunks(candidates);
  answerFrom(context);
  find('generate').disabled = running || !['available','downloadable','downloading'].includes(modelState) || !context.length;
}

function showGenerated(response) {
  const output = find('generated');
  output.replaceChildren();
  for (const part of response.split(/(\[[a-z]+-\d+\])/gi)) {
    const id = /^\[([a-z]+-\d+)\]$/i.exec(part)?.[1].toLowerCase();
    const source = id && find('chunk-'+id);
    if (source?.classList.contains('included')) {
      const link = element('a',part);
      link.href = '#chunk-'+id;
      output.append(link);
    } else {
      output.append(document.createTextNode(id ? part+'（未在上下文中）' : part));
    }
  }
  output.hidden=false;
}

function evaluate(chunks, settings) {
  find('evaluation').replaceChildren(...tasks.map(example => {
    const row = element('tr');
    const hits = rank(example.query,chunks,settings.method,settings.expand);
    const {candidates,context} = chooseContext(hits,settings.top,settings.budget);
    const count = set => example.expected.length
      ? evidenceCoverage(set,example).filter(Boolean).length + ' / ' + example.expected.length
      : '无标注答案';
    const title = element('th',example.label);
    title.scope = 'row';
    row.append(title,element('td',count(candidates)),element('td',count(context)));
    return row;
  }));
}

function search() {
  query = find('question').value.trim();
  task = tasks.find(example => example.query === query);
  for (const button of find('tasks').children) {
    button.setAttribute('aria-pressed',String(button.dataset.id === task?.id));
  }
  const settings = options(), custom = appendix();
  const chunks = chunksOf(custom.text ? [...documents,custom] : documents,settings.mode);
  ranked = rank(query,chunks,settings.method,settings.expand);
  excluded.clear();
  find('top-value').textContent = settings.top;
  find('budget-value').textContent = settings.budget;
  updateAnswer();
  evaluate(chunks,settings);
}

for (const example of tasks) {
  const button = element('button',example.label,'secondary');
  button.type='button';
  button.dataset.id = example.id;
  button.onclick=()=>{
    find('question').value=example.query;
    search();
  };
  find('tasks').append(button);
}
for (const doc of documents) {
  const details=element('details');
  details.append(element('summary',doc.title),element('p',doc.text,'source-text'));
  find('library').append(details);
}

find('search').onsubmit = event => { event.preventDefault(); search(); };
for (const id of ['chunks','ranker','expand','top','budget']) find(id).oninput = search;
find('copy').onclick = async () => {
  try {
    await navigator.clipboard.writeText(find('prompt').textContent);
    find('copy').textContent = '已复制提示词';
    setTimeout(() => { find('copy').textContent = '复制提示词'; },2000);
  } catch {
    find('copy').textContent = '请从上方手动复制';
    find('prompt').parentElement.open=true;
  }
};

async function checkModel() {
  try {
    modelState = await globalThis.LanguageModel?.availability(config) ?? 'unavailable';
  } catch { modelState = 'unavailable'; }
  const descriptions = {
    available:'浏览器已备好英文模型。生成结果可能引用错段落，请点击证据逐条核对。',
    downloadable:'此设备可下载浏览器模型。首次生成可能需要下载较大的模型文件。',
    downloading:'浏览器正在准备本机模型。',
    unavailable:'当前浏览器或设备无法使用英文内置模型。仍可检查证据、运行规则回答或复制提示词。'
  };
  find('model-status').textContent=descriptions[modelState] ?? descriptions.unavailable;
  updateAnswer();
}
find('generate').onclick = async () => {
  const generation = version, prompt = find('prompt').textContent;
  let session;
  running=true;
  find('generate').disabled=true;
  find('model-status').textContent='正在本机生成英文回答…';
  try {
    session = await globalThis.LanguageModel.create(config);
    const response = await session.prompt(prompt);
    if (generation === version) {
      showGenerated(response);
      find('model-status').textContent='本机模型已回答。正文由模型生成，请检查每条引用是否支持相邻主张。';
    }
  } catch {
    if (generation === version) find('model-status').textContent='本机生成未完成。可继续使用规则回答或复制提示词。';
  } finally {
    session?.destroy();
    running=false;
    if (generation !== version) await checkModel();
    else find('generate').disabled=false;
  }
};
find('question').value = tasks[0].query;
search();
checkModel();
