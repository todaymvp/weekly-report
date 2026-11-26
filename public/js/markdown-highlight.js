/* HJSEC Markdown 语法高亮（零依赖、先转义后着色，杜绝 XSS）
 * 支持：c/cpp/python/bash/sh/javascript/js/typescript/ts/java/go/rust/json/yaml/sql 等
 */
(function () {
  'use strict';

  // 已知关键字表；未知语言退化为纯文本（不报错、不高亮）
  const KEYWORDS = {
    c: ['int','char','float','double','void','long','short','unsigned','signed','const','static','struct','enum','union','typedef','if','else','for','while','do','switch','case','default','break','continue','return','sizeof','#include','#define','#ifdef','#ifndef','#endif','NULL'],
    cpp: ['int','char','float','double','void','bool','auto','long','short','unsigned','const','static','struct','enum','class','template','typename','namespace','using','public','private','protected','virtual','override','if','else','for','while','do','switch','case','default','break','continue','return','new','delete','true','false','nullptr','#include','#define','std','cout','cin'],
    python: ['def','class','if','elif','else','for','while','in','not','and','or','is','return','yield','import','from','as','with','try','except','finally','raise','pass','break','continue','lambda','None','True','False','self','print','len','range','str','int','float','list','dict','set','tuple'],
    javascript: ['const','let','var','function','return','if','else','for','while','do','switch','case','default','break','continue','class','extends','new','this','super','import','from','export','default','async','await','try','catch','finally','throw','typeof','instanceof','null','undefined','true','false','console'],
    typescript: ['const','let','var','function','return','if','else','for','while','class','extends','new','this','import','from','export','default','async','await','try','catch','throw','interface','type','enum','implements','public','private','protected','readonly','string','number','boolean','void','any','null','undefined','true','false'],
    java: ['public','private','protected','static','final','class','interface','extends','implements','new','this','super','if','else','for','while','do','switch','case','default','break','continue','return','try','catch','finally','throw','throws','int','long','double','float','boolean','char','void','String','null','true','false','import','package'],
    go: ['package','import','func','return','if','else','for','range','switch','case','default','break','continue','var','const','type','struct','interface','map','chan','go','defer','select','nil','true','false','make','new','len','append'],
    rust: ['fn','let','mut','const','static','struct','enum','impl','trait','for','in','if','else','match','loop','while','return','break','continue','use','mod','pub','crate','self','Self','as','where','move','ref','true','false','Some','None','Ok','Err','String','Vec','Option','Result'],
    sql: ['SELECT','FROM','WHERE','INSERT','INTO','VALUES','UPDATE','SET','DELETE','CREATE','TABLE','DROP','ALTER','ADD','COLUMN','PRIMARY','KEY','FOREIGN','REFERENCES','JOIN','LEFT','RIGHT','INNER','OUTER','ON','GROUP','BY','ORDER','HAVING','LIMIT','OFFSET','AS','AND','OR','NOT','NULL','IS','IN','LIKE','DISTINCT','COUNT','SUM','AVG','MIN','MAX','select','from','where','insert','update','delete','create','table','join','group','order','by','limit'],
    json: ['true','false','null'],
    yaml: ['true','false','null','yes','no','on','off'],
    csharp: ['using','namespace','class','struct','interface','enum','public','private','protected','internal','static','readonly','const','void','int','long','float','double','decimal','bool','char','string','object','var','new','return','if','else','switch','case','default','break','continue','for','foreach','while','do','try','catch','finally','throw','async','await','this','base','null','true','false','override','virtual','abstract','sealed','partial','get','set','params','ref','out','in','is','as','typeof','sizeof','nameof','where','yield','lock','event','delegate'],
    bash: ['if','then','else','elif','fi','for','while','until','do','done','case','esac','function','in','select','time','coproc','return','break','continue','exit','local','export','readonly','declare','typeset','unset','shift','source','alias','unalias','set','trap','eval','exec','echo','printf','read','cd','pwd','test','true','false','sudo','apt','apt-get','yum','dnf','pacman','git','make','cmake','gcc','g++','python','python3','pip','pip3','curl','wget','chmod','chown','mkdir','rm','cp','mv','cat','grep','sed','awk','find','ls','tar','ssh','scp','docker','systemctl','service','ps','kill','nohup','nc','nmap','objdump','gdb','readelf','checksec'],
    php: ['<?php','?>','function','class','interface','trait','extends','implements','public','private','protected','static','const','var','new','return','if','else','elseif','foreach','for','while','do','switch','case','default','break','continue','try','catch','finally','throw','namespace','use','echo','print','isset','unset','empty','array','list','true','false','null','and','or','xor','as','global','require','require_once','include','include_once','fn','match','yield','clone','instanceof','insteadof'],
    ruby: ['def','end','class','module','if','elsif','else','unless','while','until','for','in','do','begin','rescue','ensure','raise','return','yield','break','next','redo','retry','self','nil','true','false','and','or','not','then','case','when','require','require_relative','attr_accessor','attr_reader','attr_writer','puts','print','lambda','proc','new','super','include','extend','private','public','protected','module_function'],
    kotlin: ['fun','val','var','class','object','interface','data','sealed','enum','companion','init','constructor','if','else','when','for','while','do','return','break','continue','try','catch','finally','throw','import','package','as','is','in','!in','out','by','lazy','lateinit','override','open','abstract','private','public','protected','internal','suspend','inline','reified','where','null','true','false','this','super','it'],
    swift: ['func','var','let','class','struct','enum','protocol','extension','import','if','else','guard','switch','case','default','for','in','while','repeat','return','break','continue','defer','do','try','catch','throw','throws','rethrows','init','deinit','self','Self','super','nil','true','false','public','private','fileprivate','internal','open','static','final','override','mutating','lazy','weak','unowned','where','as','is','inout','some','any'],
    lua: ['function','local','end','if','then','elseif','else','for','do','while','repeat','until','return','break','in','not','and','or','nil','true','false','self','require','print','pairs','ipairs','table','string','math','io','os','setmetatable','getmetatable','pcall','error','tostring','tonumber','type','select','unpack'],
    perl: ['my','our','local','sub','package','use','require','if','elsif','else','unless','while','until','for','foreach','do','last','next','redo','return','print','printf','say','die','warn','eval','defined','undef','scalar','@ARGV','shift','push','pop','keys','values','each','sort','map','grep','split','join','chomp','substr','index','length','ref','bless','new'],
    r: ['function','if','else','for','while','repeat','break','next','return','TRUE','FALSE','NULL','NA','NaN','Inf','in','library','require','print','cat','paste','c','list','data.frame','matrix','vector','apply','lapply','sapply','tapply','mean','median','sd','var','sum','length','nrow','ncol','subset','merge'],
    dart: ['class','abstract','implements','extends','with','mixin','enum','typedef','import','export','library','part','if','else','switch','case','default','for','while','do','break','continue','return','try','catch','finally','throw','rethrow','new','const','final','var','late','static','void','int','double','num','String','bool','List','Map','Set','dynamic','async','await','yield','sync','get','set','required','factory','operator','is','as','in','null','true','false','this','super'],
    scala: ['def','val','var','class','object','trait','case','sealed','abstract','final','implicit','override','private','protected','public','package','import','if','else','match','for','while','do','return','try','catch','finally','throw','yield','new','this','super','null','true','false','None','Some','Option','Either','List','Map','Set','Seq','extends','with','type','lazy','def'],
    haskell: ['module','where','import','qualified','as','hiding','data','type','newtype','class','instance','deriving','let','in','case','of','if','then','else','do','return','pure','map','filter','foldr','foldl','head','tail','null','True','False','Just','Nothing','Maybe','Either','Int','Integer','String','Char','Bool','putStrLn','print','main'],
    powershell: ['function','param','if','elseif','else','switch','foreach','for','while','do','until','break','continue','return','try','catch','finally','throw','trap','begin','process','end','filter','class','enum','using','namespace','null','true','false','Get-Item','Set-Item','Where-Object','ForEach-Object','Select-Object','Write-Host','Write-Output','New-Object','Invoke-Expression','Invoke-WebRequest','$PSItem','$_'],
    asm: ['mov','lea','push','pop','call','ret','jmp','je','jne','jz','jnz','jg','jge','jl','jle','ja','jb','cmp','test','add','sub','mul','imul','div','idiv','inc','dec','and','or','xor','not','shl','shr','sal','sar','nop','leave','enter','int','syscall','section','global','extern','db','dw','dd','dq','equ','times','bits','org','eip','esp','ebp','eax','ebx','ecx','edx','esi','edi','rax','rdi','rsi','rdx','rcx'],
    dockerfile: ['FROM','RUN','CMD','LABEL','EXPOSE','ENV','ADD','COPY','ENTRYPOINT','VOLUME','USER','WORKDIR','ARG','ONBUILD','STOPSIGNAL','HEALTHCHECK','SHELL','AS','MAINTAINER'],
    nginx: ['server','location','upstream','listen','server_name','root','index','proxy_pass','proxy_set_header','rewrite','return','include','error_page','access_log','error_log','try_files','add_header','ssl_certificate','ssl_certificate_key','client_max_body_size','gzip','worker_processes','events','http','if','set','deny','allow'],
    toml: ['true','false'],
    ini: ['true','false','yes','no','on','off'],
    graphql: ['query','mutation','subscription','fragment','on','type','interface','union','enum','input','scalar','schema','extend','implements','directive','true','false','null'],
    protobuf: ['syntax','package','import','option','message','enum','service','rpc','returns','repeated','optional','required','oneof','map','reserved','extend','extensions','string','int32','int64','uint32','uint64','bool','bytes','double','float','true','false'],
    elixir: ['def','defp','defmodule','defstruct','defimpl','defprotocol','do','end','if','else','unless','cond','case','when','with','for','fn','try','rescue','catch','after','raise','receive','send','spawn','import','alias','use','require','nil','true','false','and','or','not','in','|>','Enum','Map','List','String','IO'],
    julia: ['function','end','if','elseif','else','for','while','begin','let','do','try','catch','finally','return','break','continue','module','using','import','export','struct','mutable','abstract','primitive','const','global','local','macro','quote','where','in','isa','nothing','true','false','println','print','typeof','Int','Float64','String','Array','Dict','Tuple'],
    zig: ['fn','const','var','pub','export','extern','struct','enum','union','error','if','else','while','for','switch','return','break','continue','defer','errdefer','try','catch','orelse','unreachable','async','await','comptime','inline','nosuspend','suspend','resume','test','usingnamespace','anytype','void','bool','true','false','null','undefined']
  };

  const ALIASES = {
    js: 'javascript', jsx: 'javascript', mjs: 'javascript', cjs: 'javascript',
    ts: 'typescript', tsx: 'typescript',
    py: 'python', py3: 'python', python3: 'python',
    sh: 'bash', shell: 'bash', zsh: 'bash', console: 'bash', terminal: 'bash',
    powershell: 'bash', ps1: 'bash', bat: 'bash', cmd: 'bash',
    cxx: 'cpp', 'c++': 'cpp', cc: 'cpp', h: 'c', hpp: 'cpp',
    cs: 'csharp', 'c#': 'csharp', csharp: 'csharp', objc: 'cpp', m: 'cpp',
    rs: 'rust', go1: 'go', golang: 'go',
    yml: 'yaml', jsonc: 'json', json5: 'json',
    htm: 'html', xhtml: 'html', svg: 'html', vue: 'html',
    scss: 'css', sass: 'css', less: 'css',
    md: 'markdown', docker: 'dockerfile',
    plaintext: '', text: '', txt: '', log: '', output: '',

    rb: 'ruby', rake: 'ruby', gemfile: 'ruby',
    kt: 'kotlin', kts: 'kotlin',
    swift: 'swift', lua: 'lua', pl: 'perl', pm: 'perl', perl5: 'perl',
    rstats: 'r', stats: 'r', rscript: 'r',
    'dart': 'dart', scale: 'scala', hs: 'haskell', haskell: 'haskell',
    pwsh: 'powershell', psm1: 'powershell', asm: 'asm', nasm: 'asm', gas: 'asm',
    nginx: 'nginx', conf: 'nginx', ini: 'ini', cfg: 'ini', properties: 'ini',
    toml: 'toml', make: 'makefile', mk: 'makefile', gnumake: 'makefile',
    patch: 'diff', proto: 'protobuf', gql: 'graphql',
    ex: 'elixir', exs: 'elixir', jl: 'julia', zig: 'zig',
    objectivec: 'objc', 'objective-c': 'objc'
  };

  // 只在标签之外的文本段落上做替换（HTML 标签原样跳过）
  function mapText(html, fn) {
    return String(html)
      .split(/(<[^>]*>|\u0005H\d+\u0005)/)
      .map((seg, i) => (i % 2 === 1 ? seg : fn(seg)))
      .join('');
  }

  // 先转义，再用正则给 token 包 span（每段只处理一次，避免嵌套）
  function highlight(code, langRaw) {
    const lang = ALIASES[langRaw] || langRaw || '';
    const esc = String(code)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
    const kws = KEYWORDS[lang] || null;

    // 用占位符分块：字符串 / 注释 优先保护
    const holds = [];
    const hold = (html) => {
      const i = holds.length;
      holds.push(html);
      return '\u0005H' + i + '\u0005';
    };

    let s = esc;
    // 双引号字符串、单引号字符串（含转义）
    s = s.replace(/(&quot;)(?:[^&]|&(?!quot;))*?\1|(&#39;)(?:[^&]|&(?!#39;))*?\2/g, (m) => hold('<span class="tok-str">' + m + '</span>'));
    // 反引号（Go / JS 模板，转义后仍是 ` ）
    s = s.replace(/`[^`\n]*`/g, (m) => hold('<span class="tok-str">' + m + '</span>'));
    // ---------- 语言特化 pass ----------
    // HTML / XML / Vue：标签名与属性名
    if (/^(html|xml|markup|vue)$/.test(lang)) {
      s = s.replace(/(&lt;\/?)([a-zA-Z][\w:-]*)/g, (m, br, tag) => br + hold('<span class="tok-tag">' + tag + '</span>'));
      s = s.replace(/\s([a-zA-Z_:][\w:.-]*)(=)/g, (m, sp, attr, eq) => sp + hold('<span class="tok-attr">' + attr + '</span>') + eq);
    }
    // CSS / SCSS / LESS：属性名与类选择器
    if (/^(css|scss|sass|less)$/.test(lang)) {
      s = s.replace(/(^|[\s{;])([-a-zA-Z]+)(\s*:)/g, (m, pre, prop, colon) => pre + hold('<span class="tok-prop">' + prop + '</span>') + colon);
      s = s.replace(/([.#][-\w]+)(?=[\s,{:])/g, (m) => hold('<span class="tok-tag">' + m + '</span>'));
    }
    // diff / patch：增删行
    if (lang === 'diff') {
      s = s.replace(/(^|\n)(\+[^\n]*)/g, (m, pre, line) => pre + hold('<span class="tok-add">' + line + '</span>'));
      s = s.replace(/(^|\n)(-[^\n]*)/g, (m, pre, line) => pre + hold('<span class="tok-del">' + line + '</span>'));
    }
    // shell / powershell：$变量
    if (/^(bash|powershell)$/.test(lang)) {
      s = s.replace(/(^|[^\\])(\$\{?[A-Za-z_]\w*\}?)/g, (m, pre, va) => pre + hold('<span class="tok-var">' + va + '</span>'));
    }

    // 行注释：// 与 #（bash/yaml/python）与 --（sql）
    if (/^(bash|python|yaml|sql)$/.test(lang)) {
      s = s.replace(/(^|\n)([ \t]*)(#|--)[^\n]*/g, (m, pre, space) => pre + space + hold('<span class="tok-com">' + m.slice(pre.length + space.length) + '</span>'));
    }
    s = s.replace(/\/\/[^\n]*/g, (m) => hold('<span class="tok-com">' + m + '</span>'));
    // 块注释 /* ... */
    s = s.replace(/\/\*[\s\S]*?\*\//g, (m) => hold('<span class="tok-com">' + m + '</span>'));

    // JSON key："key":
    if (lang === 'json') {
      s = s.replace(/(&quot;[^&]*?&quot;)(\s*:)/g, '<span class="tok-key">$1</span>$2');
    }
    // YAML key: key: value
    if (lang === 'yaml') {
      s = s.replace(/(^|\n)([ \t]*)([\w.-]+)(:)/g, (m, pre, sp, key, colon) => pre + sp + '<span class="tok-key">' + key + '</span>' + colon);
    }

    // 预处理指令 / 宏（C / C++ / C#）：单独一种颜色
    if (/^(c|cpp|csharp|objc)$/.test(lang)) {
      s = s.replace(/(^|\n)([ \t]*)(#[ \t]*(?:include|include_next|define|undef|ifdef|ifndef|endif|pragma|error|warning))([^\n]*)/g,
        (m, pre, sp, dir, rest) => pre + sp + hold('<span class="tok-pre">' + dir + '</span>') + rest);
    }

    // 数字
    s = mapText(s, (t) => t.replace(/\b(\d+(?:\.\d+)?)\b/g, '<span class="tok-num">$1</span>'));
    // 关键字（长词优先，避免前缀误匹配）
    if (kws && kws.length) {
      const sorted = kws.slice().sort((a, b) => b.length - a.length);
      const pattern = new RegExp('\\b(' + sorted.map((k) => k.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('|') + ')\\b', 'g');
      s = mapText(s, (t) => t.replace(pattern, '<span class="tok-kw">$1</span>'));
    }
    // 函数名：标识符后跟 ( —— 只处理标签外的纯文本，避免改坏 class 属性
    s = mapText(s, (t) => t.replace(/\b([A-Za-z_]\w*)(?=[ \t]*\()/g, (m, name) =>
      (kws && kws.indexOf(name) >= 0) ? m : '<span class="tok-fn">' + name + '</span>'));

    // 还原占位符（字符串 / 注释不再被后续规则处理）
    s = s.replace(/\u0005H(\d+)\u0005/g, (_m, i) => holds[Number(i)] || '');
    return s;
  }

  window.mdHighlight = highlight;
})();
