/**
 * 研究 Agent — 输出质量保障层（确定性格式化引擎）
 *
 * 架构定位：与 tools.ts 中注册的 LLM 格式化工具（format_markdown / fix_json）构成双层防线：
 *
 *   1. 本模块 = 确定性管道：零 LLM 成本、必执行、可单测。
 *      - 出口：runAgentTurn 最终回答（formatFinalAnswer：截断检测 → markdown 修复 → 诚实标注）
 *      - 中间调度：工具调用 JSON 的后校正（extractJson + repairJson，挂在 tryParseToolCall）
 *      - 前校验：validateToolArgs（挂在工具执行前，参数非法直接回喂模型重试）
 *   2. LLM 工具 = 模型主动侧入口：整理草稿、修复外部损坏 JSON。
 *
 * 修复原则：只做结构层面可验证的修复（围栏配对、括号配对、JSON 语法级修复），
 * 不做内容层面的猜测改写，避免误伤正常输出。
 */

/** 从任意文本中提取第一个完整 JSON 结构（{…} 或 […]），括号配对准确定界。
 *  剥离开头噪声与 ```json 围栏；未闭合时返回从起始到末尾的截断候选（交给 repairJson 补全）。 */
export function extractJson(text: string): string | null {
  if (!text) return null;
  const trimmed = text.trim();
  const fence = trimmed.match(/```(?:json)?\s*([\s\S]*?)```/);
  const candidate = (fence ? fence[1] : trimmed).trim();
  const startIdx = candidate.search(/[[{]/);
  if (startIdx === -1) return null;
  let depth = 0;
  let inStr = false;
  let esc = false;
  for (let i = startIdx; i < candidate.length; i++) {
    const ch = candidate[i];
    if (inStr) {
      if (esc) esc = false;
      else if (ch === '\\') esc = true;
      else if (ch === '"') inStr = false;
      continue;
    }
    if (ch === '"') inStr = true;
    else if (ch === '{' || ch === '[') depth++;
    else if (ch === '}' || ch === ']') {
      depth--;
      if (depth === 0) return candidate.slice(startIdx, i + 1);
    }
  }
  return candidate.slice(startIdx); // 未闭合：截断候选
}

/** 逐级修复损坏的 JSON：尾逗号 → 未加引号的 key → 单引号字符串 → 括号截断补全。
 *  每级修复后立即尝试解析，成功即返回；全部失败返回 null。 */
export function repairJson(raw: string): string | null {
  if (!raw) return null;
  let s = extractJson(raw) ?? raw.trim();
  if (!s) return null;

  const tryParse = (x: string): boolean => {
    try {
      JSON.parse(x);
      return true;
    } catch {
      return false;
    }
  };
  if (tryParse(s)) return s;

  // 修复级数从轻到重：每一级都对当前串做完整修复再验证
  const passes: Array<(x: string) => string> = [
    // 1. 尾逗号（对象/数组结尾的悬空逗号）
    (x) => x.replace(/,\s*([}\]])/g, '$1'),
    // 2. 未加引号的 key：{a: 1, "b": 2} → {"a": 1, "b": 2}
    (x) => x.replace(/([{,]\s*)([A-Za-z_$][\w$-]*)(\s*:)/g, '$1"$2"$3'),
    // 3. 单引号字符串 → 双引号（仅替换成对单引号，转义与换行除外）
    (x) => x.replace(/'([^'\\\n]|\\.)*'/g, (m) => m.replace(/'/g, '"')),
    // 4. 字符串内的裸换行/制表符转义（只处理引号内——用字符扫描代替正则，避免破坏结构）
    (x) => x,
  ];

  let current = s;
  for (const pass of passes) {
    const next = pass(current);
    if (next === current) continue;
    current = next;
    if (tryParse(current)) return current;
  }

  // 5. 截断补全：括号未闭合（跳过字符串内），按逆序补齐
  const closed = closeBrackets(current);
  if (closed !== current) {
    current = closed;
    if (tryParse(current)) return current;
  }

  return null;
}

/** 按括号配对补齐缺失的闭合符（忽略字符串内的括号）。 */
function closeBrackets(s: string): string {
  const stack: string[] = [];
  let inStr = false;
  let esc = false;
  for (const ch of s) {
    if (inStr) {
      if (esc) esc = false;
      else if (ch === '\\') esc = true;
      else if (ch === '"') inStr = false;
      continue;
    }
    if (ch === '"') inStr = true;
    else if (ch === '{' || ch === '[') stack.push(ch);
    else if (ch === '}' || ch === ']') {
      const open = stack.pop();
      if (open === '{' && ch !== '}' || open === '[' && ch !== ']') return s; // 错配，不强行修复
    }
  }
  if (stack.length === 0) return s;
  const closes = stack.reverse().map((o) => (o === '{' ? '}' : ']')).join('');
  return s + closes;
}

/** 修复常见 Markdown 语法问题（结构层面，不改写内容）：
 *  未闭合代码块围栏补全、行尾空白清理、多余空行压缩、非法控制字符剥离。 */
export function fixMarkdown(text: string): string {
  if (!text) return text;
  let s = text;
  // 1. 代码块围栏配对（行首 ``` 计数为奇数 → 末尾补围栏）
  const fences = (s.match(/^```/gm) || []).length;
  if (fences % 2 === 1) s = s.trimEnd() + '\n```';
  // 2. 行尾空白（对代码块内也安全：不影响缩进语义）
  s = s.replace(/[ \t]+$/gm, '');
  // 3. 3+ 连续空行 → 2
  s = s.replace(/\n{3,}/g, '\n\n');
  // 4. 剥离 BOM 与非法控制字符（保留 \t \n \r）
  s = s.replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, '');
  return s.trim();
}

/** 检测内容是否被截断：只认结构性信号（未闭合代码块/括号/引号、行尾悬空列表或表格符），
 *  不做句子语义猜测，避免把正常回答误判为截断。 */
export function detectTruncation(text: string): boolean {
  if (!text) return false;
  // 1. 代码块围栏未闭合
  if ((text.match(/^```/gm) || []).length % 2 === 1) return true;
  // 2. 成对符号开多于闭（跳过字符串内内容做保守处理：全局计数，误报面小）
  for (const [open, close] of [['(', ')'], ['[', ']'], ['{', '}']] as const) {
    const opens = (text.match(new RegExp('\\' + open, 'g')) || []).length;
    const closes = (text.match(new RegExp('\\' + close, 'g')) || []).length;
    if (opens > closes) return true;
  }
  // 3. 未闭合引号（双引号奇数）
  if ((text.match(/"/g) || []).length % 2 === 1) return true;
  // 4. 末尾是半截结构：悬空列表符 / 表格分隔 / 代码块语言标记
  const lastLine = text.trimEnd().split('\n').pop() ?? '';
  if (/^[-*+]\s*$/.test(lastLine)) return true;
  if (/^\d+[.)]\s*$/.test(lastLine)) return true;
  if (/^\|[\s|]*$/.test(lastLine)) return true;
  if (/^```\S*$/.test(lastLine.trim())) return true;
  return false;
}

/** 最终回答出口管道：截断检测 → markdown 修复 → 截断时诚实标注。
 *  结构截断（围栏/括号）由 fixMarkdown 修复；内容半截无法恢复时追加提示行。 */
export function formatFinalAnswer(text: string): { text: string; truncated: boolean } {
  const t = (text ?? '').trim();
  if (!t) return { text: '', truncated: false };
  const truncated = detectTruncation(t);
  const fixed = fixMarkdown(t);
  if (truncated) {
    return {
      text: fixed + '\n\n> ⚠️ 回答因长度限制被截断，如需完整内容可追问。',
      truncated: true,
    };
  }
  return { text: fixed, truncated: false };
}

/** 工具调用参数前校验（宽松策略）：必填缺失与明显类型错误才拦截，
 *  可无损转换的值（如数字字符串）放行——目的是防无效调用，不是拒绝合法参数。 */
export function validateToolArgs(
  tool: { name: string; parameters: Record<string, unknown> },
  args: Record<string, unknown>
): string | null {
  const schema = tool.parameters as { required?: string[]; properties?: Record<string, { type?: string }> };
  const required = schema.required ?? [];
  const properties = schema.properties ?? {};

  for (const key of required) {
    const v = args[key];
    if (v === undefined || v === null || v === '') {
      return `缺少必填参数 "${key}"`;
    }
  }

  for (const [key, value] of Object.entries(args)) {
    if (value === undefined || value === null) continue;
    const type = properties[key]?.type;
    if (!type) continue;
    if (type === 'string') {
      if (typeof value !== 'string' && typeof value !== 'number' && typeof value !== 'boolean') {
        return `参数 "${key}" 应为字符串，实际为 ${Array.isArray(value) ? '数组' : typeof value}`;
      }
    } else if (type === 'number' || type === 'integer') {
      const ok = typeof value === 'number'
        || (typeof value === 'string' && value.trim() !== '' && Number.isFinite(Number(value)));
      if (typeof value === 'boolean' || !ok) {
        return `参数 "${key}" 应为数字，实际为 ${typeof value}`;
      }
    } else if (type === 'boolean') {
      if (typeof value !== 'boolean' && !['true', 'false'].includes(String(value))) {
        return `参数 "${key}" 应为布尔值，实际为 ${typeof value}`;
      }
    }
  }
  return null;
}
