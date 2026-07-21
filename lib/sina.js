/*
 * Sina 7x24 News API Config
 *
 * API Endpoint: https://zhibo.sina.com.cn/api/zhibo/feed
 *
 * Parameters:
 * - page: number, 当前所在的页面
 * - page_size: number, 返回的条目数量
 * - zhibo_id: number, 固定为 152
 * - tag_id: number, 分类，0 表示全部
 * - dire: string, 设为 f
 * - dpc: number, 设为 1
 * - type: number, 设为 0
 */

const endpoint = 'https://zhibo.sina.com.cn/api/zhibo/feed';
const params = new URLSearchParams({
  page: 1,
  page_size: 100,
  zhibo_id: 152,
  tag_id: 0,
  dire: 'f',
  dpc: 1,
  type: 0,
});

export const url = endpoint + '?' + params.toString();
export { endpoint, params };
