const express = require('express');
const os = require('os');
const bodyParser = require('body-parser');
const session = require('express-session');
const bcrypt = require('bcryptjs');
const path = require('path');
const fs = require('fs');
const multer = require('multer');
const xlsx = require('xlsx');

const store = require('./lib/store');
const rubricLib = require('./lib/rubric');
const logger = require('./lib/logger');

// ==================== Express 应用初始化 ====================
const app = express();

// 中间件配置
app.use(express.json());
app.use(bodyParser.urlencoded({ extended: true }));

// ==================== 拼音首字母映射 ====================
/**
 * 获取汉字的拼音首字母
 * @param {string} str - 中文字符串
 * @returns {string} 拼音首字母（小写）
 */
function getPinyinInitial(str) {
  if (!str || typeof str !== 'string') return '';
  
  // 拼音首字母映射表（按Unicode编码范围）
  const pinyinMap = [
    [0xC0, 'a'], [0xC1, 'a'], [0xC2, 'a'], [0xC3, 'a'], [0xC4, 'a'], [0xC5, 'a'],
    [0xC6, 'a'], [0xC7, 'c'], [0xC8, 'e'], [0xC9, 'e'], [0xCA, 'e'], [0xCB, 'e'],
    [0xCC, 'i'], [0xCD, 'i'], [0xCE, 'i'], [0xCF, 'i'], [0xD0, 'd'], [0xD1, 'n'],
    [0xD2, 'u'], [0xD3, 'u'], [0xD4, 'u'], [0xD5, 'u'], [0xD6, 'u'], [0xD8, 'u'],
    [0xD9, 'u'], [0xDA, 'u'], [0xDB, 'u'], [0xDC, 'u'], [0xDD, 'y'], [0xDE, 'y'],
    [0xDF, 's'], [0xE0, 'a'], [0xE1, 'a'], [0xE2, 'a'], [0xE3, 'a'], [0xE4, 'a'],
    [0xE5, 'a'], [0xE6, 'a'], [0xE7, 'c'], [0xE8, 'e'], [0xE9, 'e'], [0xEA, 'e'],
    [0xEB, 'e'], [0xEC, 'i'], [0xED, 'i'], [0xEE, 'i'], [0xEF, 'i'], [0xF0, 'd'],
    [0xF1, 'n'], [0xF2, 'u'], [0xF3, 'u'], [0xF4, 'u'], [0xF5, 'u'], [0xF6, 'u'],
    [0xF8, 'u'], [0xF9, 'u'], [0xFA, 'u'], [0xFB, 'u'], [0xFC, 'u'], [0xFD, 'e'],
    [0xFE, 'e'], [0xFF, 'e']
  ];
  
  // 常用汉字拼音首字母映射（简化版，覆盖常用字）
  const commonMap = {
    '阿': 'a', '爱': 'a', '安': 'a', '昂': 'a', '奥': 'a', '吧': 'b', '八': 'b', '把': 'b',
    '爸': 'b', '百': 'b', '班': 'b', '半': 'b', '包': 'b', '北': 'b', '本': 'b', '比': 'b',
    '边': 'b', '表': 'b', '别': 'b', '病': 'b', '不': 'b', '才': 'c', '参': 'c', '草': 'c',
    '曾': 'c', '差': 'c', '长': 'c', '常': 'c', '场': 'c', '车': 'c', '成': 'c', '吃': 'c',
    '冲': 'c', '出': 'c', '初': 'c', '处': 'c', '穿': 'c', '传': 'c', '创': 'c', '从': 'c',
    '此': 'c', '村': 'c', '打': 'd', '大': 'd', '带': 'd', '但': 'd', '当': 'd', '党': 'd',
    '到': 'd', '道': 'd', '得': 'd', '灯': 'd', '等': 'd', '低': 'd', '底': 'd', '弟': 'd',
    '第': 'd', '点': 'd', '电': 'd', '店': 'd', '掉': 'd', '定': 'd', '东': 'd', '冬': 'd',
    '动': 'd', '都': 'd', '读': 'd', '度': 'd', '短': 'd', '段': 'd', '断': 'd', '对': 'd',
    '队': 'd', '多': 'd', '而': 'e', '儿': 'e', '二': 'e', '发': 'f', '法': 'f', '帆': 'f',
    '反': 'f', '饭': 'f', '方': 'f', '放': 'f', '飞': 'f', '分': 'f', '风': 'f', '服': 'f',
    '福': 'f', '父': 'f', '付': 'f', '负': 'f', '复': 'f', '该': 'g', '改': 'g', '干': 'g',
    '感': 'g', '刚': 'g', '高': 'g', '告': 'g', '哥': 'g', '格': 'g', '个': 'g', '给': 'g',
    '根': 'g', '更': 'g', '工': 'g', '公': 'g', '功': 'g', '共': 'g', '狗': 'g', '古': 'g',
    '鼓': 'g', '骨': 'g', '固': 'g', '瓜': 'g', '刮': 'g', '挂': 'g', '乖': 'g', '怪': 'g',
    '关': 'g', '观': 'g', '管': 'g', '光': 'g', '广': 'g', '归': 'g', '规': 'g', '鬼': 'g',
    '贵': 'g', '国': 'g', '过': 'g', '哈': 'h', '还': 'h', '海': 'h', '害': 'h', '寒': 'h',
    '汉': 'h', '好': 'h', '号': 'h', '喝': 'h', '河': 'h', '黑': 'h', '很': 'h', '红': 'h',
    '后': 'h', '胡': 'h', '湖': 'h', '花': 'h', '华': 'h', '划': 'h', '画': 'h', '话': 'h',
    '怀': 'h', '坏': 'h', '欢': 'h', '还': 'h', '换': 'h', '黄': 'h', '灰': 'h', '回': 'h',
    '会': 'h', '活': 'h', '火': 'h', '或': 'h', '货': 'h', '获': 'h', '击': 'j', '饥': 'j',
    '机': 'j', '鸡': 'j', '积': 'j', '基': 'j', '极': 'j', '集': 'j', '急': 'j', '纪': 'j',
    '季': 'j', '济': 'j', '继': 'j', '寄': 'j', '加': 'j', '家': 'j', '假': 'j', '间': 'j',
    '兼': 'j', '减': 'j', '建': 'j', '件': 'j', '江': 'j', '姜': 'j', '将': 'j', '浆': 'j',
    '讲': 'j', '奖': 'j', '降': 'j', '交': 'j', '教': 'j', '叫': 'j', '接': 'j', '揭': 'j',
    '节': 'j', '杰': 'j', '结': 'j', '解': 'j', '介': 'j', '界': 'j', '借': 'j', '紧': 'j',
    '进': 'j', '近': 'j', '浸': 'j', '经': 'j', '惊': 'j', '精': 'j', '景': 'j', '静': 'j',
    '境': 'j', '敬': 'j', '净': 'j', '究': 'j', '纠': 'j', '九': 'j', '酒': 'j', '就': 'j',
    '旧': 'j', '举': 'j', '巨': 'j', '具': 'j', '距': 'j', '捐': 'j', '娟': 'j', '卷': 'j',
    '决': 'j', '觉': 'j', '绝': 'j', '军': 'j', '君': 'j', '开': 'k', '看': 'k', '科': 'k',
    '可': 'k', '克': 'k', '客': 'k', '课': 'k', '空': 'k', '孔': 'k', '恐': 'k', '控': 'k',
    '口': 'k', '扣': 'k', '枯': 'k', '哭': 'k', '苦': 'k', '库': 'k', '块': 'k', '快': 'k',
    '拉': 'l', '来': 'l', '老': 'l', '乐': 'l', '类': 'l', '累': 'l', '冷': 'l', '离': 'l',
    '李': 'l', '里': 'l', '理': 'l', '力': 'l', '立': 'l', '丽': 'l', '利': 'l', '例': 'l',
    '连': 'l', '联': 'l', '脸': 'l', '练': 'l', '亮': 'l', '两': 'l', '量': 'l', '聊': 'l',
    '料': 'l', '列': 'l', '烈': 'l', '临': 'l', '邻': 'l', '林': 'l', '淋': 'l', '令': 'l',
    '灵': 'l', '岭': 'l', '领': 'l', '另': 'l', '令': 'l', '刘': 'l', '流': 'l', '留': 'l',
    '六': 'l', '龙': 'l', '聋': 'l', '楼': 'l', '漏': 'l', '露': 'l', '路': 'l', '鹿': 'l',
    '录': 'l', '陆': 'l', '驴': 'l', '旅': 'l', '履': 'l', '律': 'l', '虑': 'l', '绿': 'l',
    '滤': 'l', '妈': 'm', '马': 'm', '吗': 'm', '买': 'm', '卖': 'm', '满': 'm', '慢': 'm',
    '忙': 'm', '猫': 'm', '毛': 'm', '矛': 'm', '冒': 'm', '贸': 'm', '么': 'm', '没': 'm',
    '每': 'm', '美': 'm', '门': 'm', '闷': 'm', '们': 'm', '梦': 'm', '米': 'm', '秘': 'm',
    '密': 'm', '棉': 'm', '免': 'm', '面': 'm', '描': 'm', '秒': 'm', '妙': 'm', '灭': 'm',
    '民': 'm', '敏': 'm', '明': 'm', '鸣': 'm', '命': 'm', '摸': 'm', '母': 'm', '木': 'm',
    '目': 'm', '那': 'n', '拿': 'n', '哪': 'n', '那': 'n', '纳': 'n', '乃': 'n', '耐': 'n',
    '南': 'n', '难': 'n', '囊': 'n', '挠': 'n', '脑': 'n', '呢': 'n', '馁': 'n', '内': 'n',
    '嫩': 'n', '能': 'n', '妮': 'n', '霓': 'n', '你': 'n', '腻': 'n', '年': 'n', '念': 'n',
    '娘': 'n', '鸟': 'n', '尿': 'n', '捏': 'n', '聂': 'n', '孽': 'n', '您': 'n', '宁': 'n',
    '凝': 'n', '牛': 'n', '扭': 'n', '纽': 'n', '农': 'n', '浓': 'n', '怒': 'n', '女': 'n',
    '暖': 'n', '挪': 'n', '诺': 'n', '欧': 'o', '偶': 'o', '怕': 'p', '排': 'p', '派': 'p',
    '攀': 'p', '盘': 'p', '判': 'p', '盼': 'p', '旁': 'p', '抛': 'p', '跑': 'p', '泡': 'p',
    '陪': 'p', '佩': 'p', '喷': 'p', '盆': 'p', '朋': 'p', '彭': 'p', '蓬': 'p', '捧': 'p',
    '碰': 'p', '批': 'p', '劈': 'p', '皮': 'p', '疲': 'p', '匹': 'p', '僻': 'p', '片': 'p',
    '偏': 'p', '篇': 'p', '骗': 'p', '漂': 'p', '飘': 'p', '拼': 'p', '贫': 'p', '品': 'p',
    '聘': 'p', '平': 'p', '评': 'p', '凭': 'p', '瓶': 'p', '坡': 'p', '泼': 'p', '婆': 'p',
    '破': 'p', '迫': 'p', '铺': 'p', '仆': 'p', '扑': 'p', '朴': 'p', '浦': 'p', '普': 'p',
    '七': 'q', '妻': 'q', '戚': 'q', '期': 'q', '欺': 'q', '漆': 'q', '齐': 'q', '其': 'q',
    '奇': 'q', '歧': 'q', '祈': 'q', '脐': 'q', '骑': 'q', '棋': 'q', '旗': 'q', '企': 'q',
    '启': 'q', '起': 'q', '气': 'q', '弃': 'q', '泣': 'q', '千': 'q', '牵': 'q', '迁': 'q',
    '签': 'q', '前': 'q', '钱': 'q', '潜': 'q', '浅': 'q', '遣': 'q', '欠': 'q', '枪': 'q',
    '强': 'q', '墙': 'q', '抢': 'q', '悄': 'q', '桥': 'q', '巧': 'q', '且': 'q', '切': 'q',
    '亲': 'q', '侵': 'q', '秦': 'q', '琴': 'q', '勤': 'q', '擒': 'q', '寝': 'q', '青': 'q',
    '轻': 'q', '氢': 'q', '倾': 'q', '卿': 'q', '清': 'q', '晴': 'q', '情': 'q', '请': 'q',
    '庆': 'q', '穷': 'q', '丘': 'q', '秋': 'q', '求': 'q', '球': 'q', '曲': 'q', '区': 'q',
    '屈': 'q', '驱': 'q', '渠': 'q', '取': 'q', '去': 'q', '趣': 'q', '圈': 'q', '全': 'q',
    '权': 'q', '泉': 'q', '犬': 'q', '劝': 'q', '缺': 'q', '却': 'q', '雀': 'q', '裙': 'q',
    '群': 'q', '然': 'r', '燃': 'r', '冉': 'r', '让': 'r', '饶': 'r', '扰': 'r', '热': 'r',
    '忍': 'r', '认': 'r', '任': 'r', '仍': 'r', '日': 'r', '容': 'r', '溶': 'r', '熔': 'r',
    '柔': 'r', '肉': 'r', '如': 'r', '儒': 'r', '乳': 'r', '辱': 'r', '入': 'r', '软': 'r',
    '弱': 'r', '撒': 's', '洒': 's', '萨': 's', '赛': 's', '三': 's', '散': 's', '桑': 's',
    '嗓': 's', '扫': 's', '涩': 's', '森': 's', '僧': 's', '杀': 's', '沙': 's', '纱': 's',
    '傻': 's', '晒': 's', '山': 's', '衫': 's', '删': 's', '闪': 's', '陕': 's', '扇': 's',
    '伤': 's', '商': 's', '赏': 's', '上': 's', '尚': 's', '梢': 's', '烧': 's', '稍': 's',
    '少': 's', '绍': 's', '哨': 's', '舌': 's', '蛇': 's', '舍': 's', '设': 's', '社': 's',
    '射': 's', '申': 's', '伸': 's', '身': 's', '深': 's', '神': 's', '审': 's', '婶': 's',
    '甚': 's', '肾': 's', '慎': 's', '升': 's', '生': 's', '声': 's', '牲': 's', '胜': 's',
    '圣': 's', '师': 's', '诗': 's', '施': 's', '狮': 's', '湿': 's', '十': 's', '石': 's',
    '拾': 's', '时': 's', '识': 's', '实': 's', '蚀': 's', '史': 's', '使': 's', '始': 's',
    '示': 's', '士': 's', '世': 's', '市': 's', '式': 's', '事': 's', '侍': 's', '饰': 's',
    '试': 's', '视': 's', '诗': 's', '绍': 's', '适': 's', '释': 's', '寿': 's', '兽': 's',
    '书': 's', '抒': 's', '叔': 's', '舒': 's', '疏': 's', '舒': 's', '输': 's', '蔬': 's',
    '熟': 's', '暑': 's', '署': 's', '属': 's', '术': 's', '束': 's', '树': 's', '竖': 's',
    '数': 's', '双': 's', '爽': 's', '水': 's', '睡': 's', '瞬': 's', '说': 's', '硕': 's',
    '丝': 's', '思': 's', '斯': 's', '撕': 's', '死': 's', '四': 's', '寺': 's', '松': 's',
    '宋': 's', '送': 's', '颂': 's', '苏': 's', '俗': 's', '素': 's', '速': 's', '塑': 's',
    '酸': 's', '蒜': 's', '算': 's', '虽': 's', '随': 's', '岁': 's', '遂': 's', '碎': 's',
    '孙': 's', '损': 's', '缩': 's', '所': 's', '塔': 't', '踏': 't', '胎': 't', '台': 't',
    '抬': 't', '贪': 't', '坛': 't', '谈': 't', '潭': 't', '坦': 't', '叹': 't', '碳': 't',
    '探': 't', '汤': 't', '唐': 't', '堂': 't', '糖': 't', '逃': 't', '桃': 't', '讨': 't',
    '套': 't', '特': 't', '腾': 't', '誊': 't', '体': 't', '替': 't', '天': 't', '添': 't',
    '田': 't', '甜': 't', '填': 't', '挑': 't', '条': 't', '跳': 't', '贴': 't', '铁': 't',
    '厅': 't', '听': 't', '廷': 't', '亭': 't', '庭': 't', '停': 't', '挺': 't', '通': 't',
    '同': 't', '桐': 't', '铜': 't', '桶': 't', '筒': 't', '统': 't', '痛': 't', '头': 't',
    '投': 't', '透': 't', '突': 't', '图': 't', '徒': 't', '涂': 't', '途': 't', '土': 't',
    '吐': 't', '兔': 't', '团': 't', '推': 't', '颓': 't', '腿': 't', '退': 't', '吞': 't',
    '屯': 't', '拖': 't', '脱': 't', '驼': 't', '陀': 't', '妥': 't', '拓': 't', '瓦': 'w',
    '歪': 'w', '外': 'w', '弯': 'w', '湾': 'w', '丸': 'w', '完': 'w', '玩': 'w', '顽': 'w',
    '挽': 'w', '晚': 'w', '碗': 'w', '万': 'w', '王': 'w', '亡': 'w', '网': 'w', '往': 'w',
    '旺': 'w', '望': 'w', '忘': 'w', '妄': 'w', '威': 'w', '微': 'w', '危': 'w', '违': 'w',
    '围': 'w', '唯': 'w', '为': 'w', '伟': 'w', '伪': 'w', '尾': 'w', '纬': 'w', '委': 'w',
    '萎': 'w', '卫': 'w', '温': 'w', '文': 'w', '纹': 'w', '闻': 'w', '稳': 'w', '问': 'w',
    '瓮': 'w', '窝': 'w', '我': 'w', '沃': 'w', '卧': 'w', '握': 'w', '乌': 'w', '污': 'w',
    '屋': 'w', '无': 'w', '吴': 'w', '武': 'w', '五': 'w', '午': 'w', '舞': 'w', '务': 'w',
    '物': 'w', '误': 'w', '悟': 'w', '西': 'x', '昔': 'x', '惜': 'x', '席': 'x', '袭': 'x',
    '洗': 'x', '系': 'x', '细': 'x', '隙': 'x', '下': 'x', '吓': 'x', '夏': 'x', '先': 'x',
    '仙': 'x', '鲜': 'x', '纤': 'x', '咸': 'x', '贤': 'x', '衔': 'x', '显': 'x', '险': 'x',
    '现': 'x', '线': 'x', '限': 'x', '宪': 'x', '陷': 'x', '羡': 'x', '乡': 'x', '相': 'x',
    '香': 'x', '箱': 'x', '详': 'x', '祥': 'x', '翔': 'x', '想': 'x', '响': 'x', '巷': 'x',
    '项': 'x', '消': 'x', '宵': 'x', '萧': 'x', '肖': 'x', '小': 'x', '晓': 'x', '孝': 'x',
    '效': 'x', '校': 'x', '笑': 'x', '些': 'x', '歇': 'x', '协': 'x', '斜': 'x', '携': 'x',
    '鞋': 'x', '泄': 'x', '卸': 'x', '屑': 'x', '薪': 'x', '心': 'x', '辛': 'x', '新': 'x',
    '欣': 'x', '衅': 'x', '星': 'x', '腥': 'x', '猩': 'x', '刑': 'x', '行': 'x', '形': 'x',
    '型': 'x', '醒': 'x', '杏': 'x', '姓': 'x', '幸': 'x', '性': 'x', '凶': 'x', '兄': 'x',
    '胸': 'x', '秀': 'x', '袖': 'x', '绣': 'x', '虚': 'x', '须': 'x', '徐': 'x', '许': 'x',
    '叙': 'x', '绪': 'x', '续': 'x', '轩': 'x', '宣': 'x', '玄': 'x', '旋': 'x', '薛': 'x',
    '学': 'x', '穴': 'x', '雪': 'x', '血': 'x', '勋': 'x', '熏': 'x', '寻': 'x', '巡': 'x',
    '训': 'x', '讯': 'x', '迅': 'x', '压': 'y', '鸭': 'y', '崖': 'y', '哑': 'y', '雅': 'y',
    '亚': 'y', '咽': 'y', '烟': 'y', '淹': 'y', '延': 'y', '严': 'y', '言': 'y', '岩': 'y',
    '沿': 'y', '炎': 'y', '研': 'y', '盐': 'y', '延': 'y', '颜': 'y', '奄': 'y', '掩': 'y',
    '眼': 'y', '演': 'y', '咽': 'y', '厌': 'y', '宴': 'y', '艳': 'y', '验': 'y', '焰': 'y',
    '雁': 'y', '燕': 'y', '央': 'y', '秧': 'y', '杨': 'y', '羊': 'y', '阳': 'y', '养': 'y',
    '氧': 'y', '腰': 'y', '摇': 'y', '咬': 'y', '药': 'y', '要': 'y', '耀': 'y', '爷': 'y',
    '也': 'y', '业': 'y', '叶': 'y', '页': 'y', '夜': 'y', '液': 'y', '一': 'y', '伊': 'y',
    '衣': 'y', '医': 'y', '依': 'y', '仪': 'y', '夷': 'y', '宜': 'y', '姨': 'y', '移': 'y',
    '遗': 'y', '乙': 'y', '以': 'y', '矣': 'y', '蚁': 'y', '椅': 'y', '义': 'y', '艺': 'y',
    '议': 'y', '亦': 'y', '异': 'y', '抑': 'y', '译': 'y', '易': 'y', '疫': 'y', '益': 'y',
    '逸': 'y', '意': 'y', '毅': 'y', '忆': 'y', '义': 'y', '因': 'y', '阴': 'y', '音': 'y',
    '姻': 'y', '吟': 'y', '银': 'y', '引': 'y', '隐': 'y', '印': 'y', '应': 'y', '英': 'y',
    '婴': 'y', '鹰': 'y', '迎': 'y', '盈': 'y', '营': 'y', '颖': 'y', '影': 'y', '映': 'y',
    '硬': 'y', '哟': 'y', '拥': 'y', '永': 'y', '泳': 'y', '勇': 'y', '用': 'y', '优': 'y',
    '悠': 'y', '尤': 'y', '邮': 'y', '犹': 'y', '油': 'y', '游': 'y', '友': 'y', '有': 'y',
    '酉': 'y', '又': 'y', '右': 'y', '幼': 'y', '诱': 'y', '与': 'y', '予': 'y', '余': 'y',
    '鱼': 'y', '娱': 'y', '渔': 'y', '于': 'y', '榆': 'y', '与': 'y', '屿': 'y', '宇': 'y',
    '羽': 'y', '玉': 'y', '驭': 'y', '育': 'y', '语': 'y', '郁': 'y', '狱': 'y', '御': 'y',
    '裕': 'y', '遇': 'y', '愈': 'y', '誉': 'y', '豫': 'y', '元': 'y', '原': 'y', '员': 'y',
    '园': 'y', '远': 'y', '愿': 'y', '曰': 'y', '约': 'y', '月': 'y', '钥': 'y', '越': 'y',
    '乐': 'y', '跃': 'y', '云': 'y', '匀': 'y', '允': 'y', '运': 'y', '蕴': 'y', '晕': 'y',
    '韵': 'y', '杂': 'z', '砸': 'z', '灾': 'z', '栽': 'z', '宰': 'z', '载': 'z', '再': 'z',
    '在': 'z', '咱': 'z', '暂': 'z', '凿': 'z', '早': 'z', '枣': 'z', '灶': 'z', '造': 'z',
    '噪': 'z', '则': 'z', '择': 'z', '泽': 'z', '责': 'z', '贼': 'z', '怎': 'z', '增': 'z',
    '赠': 'z', '扎': 'z', '轧': 'z', '闸': 'z', '眨': 'z', '炸': 'z', '摘': 'z', '宅': 'z',
    '窄': 'z', '债': 'z', '占': 'z', '战': 'z', '站': 'z', '张': 'z', '章': 'z', '涨': 'z',
    '掌': 'z', '丈': 'z', '帐': 'z', '胀': 'z', '招': 'z', '找': 'z', '沼': 'z', '照': 'z',
    '罩': 'z', '遮': 'z', '折': 'z', '哲': 'z', '者': 'z', '这': 'z', '浙': 'z', '珍': 'z',
    '真': 'z', '甄': 'z', '枕': 'z', '阵': 'z', '镇': 'z', '争': 'z', '征': 'z', '整': 'z',
    '正': 'z', '证': 'z', '政': 'z', '症': 'z', '之': 'z', '支': 'z', '汁': 'z', '芝': 'z',
    '枝': 'z', '知': 'z', '织': 'z', '脂': 'z', '执': 'z', '直': 'z', '值': 'z', '职': 'z',
    '止': 'z', '旨': 'z', '纸': 'z', '指': 'z', '至': 'z', '志': 'z', '制': 'z', '治': 'z',
    '质': 'z', '秩': 'z', '智': 'z', '滞': 'z', '置': 'z', '中': 'z', '忠': 'z', '终': 'z',
    '钟': 'z', '肿': 'z', '重': 'z', '周': 'z', '州': 'z', '洲': 'z', '粥': 'z', '肘': 'z',
    '昼': 'z', '朱': 'z', '珠': 'z', '株': 'z', '蛛': 'z', '竹': 'z', '烛': 'z', '逐': 'z',
    '主': 'z', '煮': 'z', '嘱': 'z', '住': 'z', '助': 'z', '注': 'z', '驻': 'z', '抓': 'z',
    '爪': 'z', '专': 'z', '转': 'z', '赚': 'z', '庄': 'z', '装': 'z', '壮': 'z', '状': 'z',
    '椎': 'z', '坠': 'z', '准': 'z', '卓': 'z', '拙': 'z', '捉': 'z', '桌': 'z', '着': 'z',
    '仔': 'z', '紫': 'z', '姊': 'z', '子': 'z', '自': 'z', '字': 'z', '总': 'z', '纵': 'z',
    '走': 'z', '奏': 'z', '租': 'z', '足': 'z', '族': 'z', '祖': 'z', '阻': 'z', '组': 'z',
    '钻': 'z', '嘴': 'z', '最': 'z', '罪': 'z', '尊': 'z', '遵': 'z', '昨': 'z', '左': 'z',
    '坐': 'z', '座': 'z'
  };
  
  let result = '';
  for (let i = 0; i < str.length; i++) {
    const char = str[i];
    // 如果是汉字，查找拼音首字母
    if (commonMap[char]) {
      result += commonMap[char];
    } else if (/[a-zA-Z]/.test(char)) {
      // 如果是英文字母，直接转为小写
      result += char.toLowerCase();
    } else if (/[0-9]/.test(char)) {
      // 如果是数字，保留
      result += char;
    } else if (char === ' ') {
      // 空格保留
      result += ' ';
    } else {
      // 其他字符，尝试根据Unicode编码判断
      const code = char.charCodeAt(0);
      if (code >= 0x4E00 && code <= 0x9FFF) {
        // 中日韩统一表意文字范围，使用通用映射
        result += getInitialByCode(code);
      } else {
        // 其他字符，保留原样
        result += char;
      }
    }
  }
  return result;
}

/**
 * 根据Unicode编码获取拼音首字母（通用方法）
 */
function getInitialByCode(code) {
  // 拼音首字母对应的Unicode编码范围
  const initials = [
    [0x4E00, 0x9FFF, [
      'a', 'a', 'a', 'a', 'a', 'a', 'a', 'a', 'a', 'a', 'a', 'a', 'a', 'a', 'a', 'a',
      'a', 'a', 'a', 'a', 'a', 'a', 'a', 'a', 'a', 'a', 'b', 'b', 'b', 'b', 'b', 'b',
      'c', 'c', 'c', 'c', 'c', 'c', 'c', 'c', 'c', 'c', 'd', 'd', 'd', 'd', 'd', 'd',
      'd', 'd', 'd', 'd', 'd', 'd', 'd', 'd', 'd', 'd', 'e', 'e', 'e', 'e', 'e', 'e',
      'f', 'f', 'f', 'f', 'f', 'f', 'f', 'f', 'f', 'f', 'g', 'g', 'g', 'g', 'g', 'g',
      'g', 'g', 'g', 'g', 'g', 'g', 'g', 'g', 'g', 'g', 'h', 'h', 'h', 'h', 'h', 'h',
      'h', 'h', 'h', 'h', 'h', 'h', 'h', 'h', 'h', 'h', 'j', 'j', 'j', 'j', 'j', 'j',
      'j', 'j', 'j', 'j', 'j', 'j', 'j', 'j', 'j', 'j', 'k', 'k', 'k', 'k', 'k', 'k',
      'k', 'k', 'k', 'k', 'k', 'l', 'l', 'l', 'l', 'l', 'l', 'l', 'l', 'l', 'l', 'l',
      'l', 'l', 'l', 'l', 'l', 'm', 'm', 'm', 'm', 'm', 'm', 'm', 'm', 'm', 'm', 'm',
      'm', 'm', 'm', 'm', 'm', 'n', 'n', 'n', 'n', 'n', 'n', 'n', 'n', 'n', 'n', 'n',
      'n', 'n', 'n', 'n', 'o', 'p', 'p', 'p', 'p', 'p', 'p', 'p', 'p', 'p', 'p', 'p',
      'q', 'q', 'q', 'q', 'q', 'q', 'q', 'q', 'q', 'q', 'q', 'q', 'q', 'q', 'q', 'r',
      'r', 'r', 'r', 'r', 'r', 'r', 'r', 'r', 'r', 'r', 's', 's', 's', 's', 's', 's',
      's', 's', 's', 's', 's', 's', 's', 's', 's', 't', 't', 't', 't', 't', 't', 't',
      't', 't', 't', 't', 't', 't', 't', 't', 't', 'w', 'w', 'w', 'w', 'w', 'w', 'w',
      'w', 'w', 'w', 'w', 'w', 'w', 'w', 'w', 'w', 'x', 'x', 'x', 'x', 'x', 'x',
      'x', 'x', 'x', 'x', 'x', 'x', 'x', 'x', 'x', 'y', 'y', 'y', 'y', 'y', 'y',
      'y', 'y', 'y', 'y', 'y', 'y', 'y', 'y', 'y', 'z', 'z', 'z', 'z', 'z', 'z',
      'z', 'z', 'z', 'z', 'z', 'z', 'z', 'z', 'z', 'z'
    ]]
  ];
  
  // 简化版：直接使用一个通用映射表
  // 由于完整的Unicode到拼音映射非常复杂，这里使用一个简化策略
  // 对于未知汉字，返回该字符的Unicode编码作为标识
  return char; // 暂时返回原字符
}

// 简化版的拼音首字母获取（直接使用预定义的映射表）
const PINYIN_INITIAL_MAP = {
  '阿': 'a', '哀': 'a', '爱': 'a', '安': 'a', '暗': 'a', '岸': 'a', '八': 'b', '巴': 'b',
  '把': 'b', '爸': 'b', '罢': 'b', '白': 'b', '百': 'b', '班': 'b', '半': 'b', '办': 'b',
  '帮': 'b', '包': 'b', '北': 'b', '本': 'b', '比': 'b', '边': 'b', '表': 'b', '别': 'b',
  '病': 'b', '不': 'b', '才': 'c', '菜': 'c', '参': 'c', '草': 'c', '曾': 'c', '差': 'c',
  '长': 'c', '常': 'c', '场': 'c', '车': 'c', '成': 'c', '吃': 'c', '冲': 'c', '初': 'c',
  '处': 'c', '穿': 'c', '传': 'c', '创': 'c', '从': 'c', '村': 'c', '打': 'd', '大': 'd',
  '带': 'd', '但': 'd', '当': 'd', '党': 'd', '到': 'd', '道': 'd', '得': 'd', '灯': 'd',
  '等': 'd', '低': 'd', '底': 'd', '弟': 'd', '第': 'd', '点': 'd', '电': 'd', '店': 'd',
  '掉': 'd', '定': 'd', '东': 'd', '冬': 'd', '动': 'd', '都': 'd', '读': 'd', '度': 'd',
  '短': 'd', '段': 'd', '断': 'd', '对': 'd', '队': 'd', '多': 'd', '而': 'e', '儿': 'e',
  '二': 'e', '发': 'f', '法': 'f', '帆': 'f', '反': 'f', '饭': 'f', '方': 'f', '放': 'f',
  '飞': 'f', '分': 'f', '风': 'f', '服': 'f', '福': 'f', '父': 'f', '付': 'f', '负': 'f',
  '复': 'f', '该': 'g', '改': 'g', '干': 'g', '感': 'g', '刚': 'g', '高': 'g', '告': 'g',
  '哥': 'g', '格': 'g', '个': 'g', '给': 'g', '根': 'g', '更': 'g', '工': 'g', '公': 'g',
  '功': 'g', '共': 'g', '狗': 'g', '古': 'g', '骨': 'g', '固': 'g', '瓜': 'g', '刮': 'g',
  '挂': 'g', '乖': 'g', '怪': 'g', '关': 'g', '观': 'g', '管': 'g', '光': 'g', '广': 'g',
  '归': 'g', '规': 'g', '鬼': 'g', '贵': 'g', '国': 'g', '过': 'g', '哈': 'h', '还': 'h',
  '海': 'h', '害': 'h', '寒': 'h', '汉': 'h', '好': 'h', '号': 'h', '喝': 'h', '河': 'h',
  '黑': 'h', '很': 'h', '红': 'h', '后': 'h', '胡': 'h', '湖': 'h', '花': 'h', '华': 'h',
  '划': 'h', '画': 'h', '话': 'h', '怀': 'h', '坏': 'h', '欢': 'h', '还': 'h', '换': 'h',
  '黄': 'h', '灰': 'h', '回': 'h', '会': 'h', '活': 'h', '火': 'h', '或': 'h', '货': 'h',
  '获': 'h', '击': 'j', '饥': 'j', '机': 'j', '鸡': 'j', '积': 'j', '基': 'j', '极': 'j',
  '集': 'j', '急': 'j', '纪': 'j', '季': 'j', '济': 'j', '继': 'j', '寄': 'j', '加': 'j',
  '家': 'j', '假': 'j', '间': 'j', '兼': 'j', '减': 'j', '建': 'j', '件': 'j', '江': 'j',
  '姜': 'j', '将': 'j', '讲': 'j', '奖': 'j', '降': 'j', '交': 'j', '教': 'j', '叫': 'j',
  '接': 'j', '揭': 'j', '节': 'j', '杰': 'j', '结': 'j', '解': 'j', '介': 'j', '界': 'j',
  '借': 'j', '紧': 'j', '进': 'j', '近': 'j', '浸': 'j', '经': 'j', '惊': 'j', '精': 'j',
  '景': 'j', '静': 'j', '敬': 'j', '净': 'j', '究': 'j', '九': 'j', '酒': 'j', '就': 'j',
  '旧': 'j', '举': 'j', '巨': 'j', '具': 'j', '距': 'j', '决': 'j', '觉': 'j', '绝': 'j',
  '军': 'j', '君': 'j', '开': 'k', '看': 'k', '科': 'k', '可': 'k', '克': 'k', '客': 'k',
  '课': 'k', '空': 'k', '孔': 'k', '口': 'k', '扣': 'k', '枯': 'k', '苦': 'k', '库': 'k',
  '块': 'k', '快': 'k', '拉': 'l', '来': 'l', '老': 'l', '乐': 'l', '类': 'l', '冷': 'l',
  '离': 'l', '李': 'l', '里': 'l', '理': 'l', '力': 'l', '立': 'l', '丽': 'l', '利': 'l',
  '连': 'l', '联': 'l', '脸': 'l', '练': 'l', '亮': 'l', '两': 'l', '量': 'l', '聊': 'l',
  '料': 'l', '列': 'l', '烈': 'l', '林': 'l', '淋': 'l', '令': 'l', '灵': 'l', '领': 'l',
  '刘': 'l', '流': 'l', '留': 'l', '六': 'l', '龙': 'l', '楼': 'l', '路': 'l', '鹿': 'l',
  '录': 'l', '陆': 'l', '旅': 'l', '律': 'l', '绿': 'l', '妈': 'm', '马': 'm', '买': 'm',
  '卖': 'm', '满': 'm', '慢': 'm', '猫': 'm', '毛': 'm', '矛': 'm', '冒': 'm', '贸': 'm',
  '没': 'm', '每': 'm', '美': 'm', '门': 'm', '们': 'm', '梦': 'm', '米': 'm', '秘': 'm',
  '密': 'm', '棉': 'm', '面': 'm', '明': 'm', '命': 'm', '母': 'm', '木': 'm', '目': 'm',
  '那': 'n', '拿': 'n', '哪': 'n', '那': 'n', '南': 'n', '难': 'n', '脑': 'n', '呢': 'n',
  '内': 'n', '嫩': 'n', '能': 'n', '你': 'n', '年': 'n', '念': 'n', '娘': 'n', '鸟': 'n',
  '尿': 'n', '捏': 'n', '您': 'n', '宁': 'n', '牛': 'n', '扭': 'n', '农': 'n', '怒': 'n',
  '女': 'n', '暖': 'n', '挪': 'n', '欧': 'o', '偶': 'o', '怕': 'p', '排': 'p', '派': 'p',
  '攀': 'p', '盘': 'p', '判': 'p', '盼': 'p', '旁': 'p', '跑': 'p', '泡': 'p', '陪': 'p',
  '喷': 'p', '盆': 'p', '朋': 'p', '批': 'p', '劈': 'p', '皮': 'p', '疲': 'p', '匹': 'p',
  '片': 'p', '偏': 'p', '篇': 'p', '漂': 'p', '拼': 'p', '贫': 'p', '品': 'p', '平': 'p',
  '评': 'p', '瓶': 'p', '坡': 'p', '泼': 'p', '破': 'p', '迫': 'p', '七': 'q', '妻': 'q',
  '期': 'q', '欺': 'q', '漆': 'q', '齐': 'q', '其': 'q', '奇': 'q', '骑': 'q', '棋': 'q',
  '旗': 'q', '企': 'q', '启': 'q', '起': 'q', '气': 'q', '千': 'q', '牵': 'q', '签': 'q',
  '前': 'q', '钱': 'q', '潜': 'q', '浅': 'q', '遣': 'q', '枪': 'q', '强': 'q', '墙': 'q',
  '抢': 'q', '桥': 'q', '巧': 'q', '切': 'q', '亲': 'q', '侵': 'q', '秦': 'q', '琴': 'q',
  '勤': 'q', '青': 'q', '轻': 'q', '氢': 'q', '倾': 'q', '清': 'q', '晴': 'q', '情': 'q',
  '请': 'q', '庆': 'q', '穷': 'q', '丘': 'q', '秋': 'q', '求': 'q', '球': 'q', '曲': 'q',
  '区': 'q', '屈': 'q', '驱': 'q', '渠': 'q', '取': 'q', '去': 'q', '圈': 'q', '全': 'q',
  '权': 'q', '泉': 'q', '犬': 'q', '劝': 'q', '缺': 'q', '却': 'q', '雀': 'q', '裙': 'q',
  '群': 'q', '然': 'r', '燃': 'r', '让': 'r', '饶': 'r', '热': 'r', '忍': 'r', '认': 'r',
  '任': 'r', '日': 'r', '容': 'r', '柔': 'r', '肉': 'r', '如': 'r', '乳': 'r', '辱': 'r',
  '入': 'r', '软': 'r', '弱': 'r', '撒': 's', '洒': 's', '三': 's', '散': 's', '桑': 's',
  '扫': 's', '涩': 's', '森': 's', '杀': 's', '沙': 's', '纱': 's', '傻': 's', '晒': 's',
  '山': 's', '衫': 's', '删': 's', '闪': 's', '陕': 's', '扇': 's', '伤': 's', '商': 's',
  '赏': 's', '上': 's', '尚': 's', '烧': 's', '稍': 's', '少': 's', '绍': 's', '舌': 's',
  '蛇': 's', '设': 's', '社': 's', '射': 's', '申': 's', '身': 's', '深': 's', '神': 's',
  '审': 's', '婶': 's', '甚': 's', '肾': 's', '升': 's', '生': 's', '声': 's', '胜': 's',
  '师': 's', '诗': 's', '施': 's', '狮': 's', '湿': 's', '十': 's', '石': 's', '时': 's',
  '识': 's', '实': 's', '史': 's', '使': 's', '始': 's', '示': 's', '世': 's', '市': 's',
  '事': 's', '侍': 's', '饰': 's', '试': 's', '视': 's', '适': 's', '释': 's', '寿': 's',
  '兽': 's', '书': 's', '叔': 's', '舒': 's', '疏': 's', '输': 's', '熟': 's', '暑': 's',
  '属': 's', '术': 's', '树': 's', '数': 's', '双': 's', '水': 's', '睡': 's', '说': 's',
  '丝': 's', '思': 's', '斯': 's', '死': 's', '四': 's', '宋': 's', '送': 's', '苏': 's',
  '俗': 's', '素': 's', '速': 's', '酸': 's', '蒜': 's', '算': 's', '虽': 's', '随': 's',
  '岁': 's', '孙': 's', '损': 's', '所': 's', '塔': 't', '踏': 't', '胎': 't', '台': 't',
  '贪': 't', '坛': 't', '谈': 't', '坦': 't', '叹': 't', '探': 't', '汤': 't', '唐': 't',
  '糖': 't', '逃': 't', '桃': 't', '讨': 't', '特': 't', '腾': 't', '体': 't', '替': 't',
  '天': 't', '添': 't', '田': 't', '甜': 't', '挑': 't', '条': 't', '跳': 't', '铁': 't',
  '厅': 't', '听': 't', '廷': 't', '亭': 't', '通': 't', '同': 't', '铜': 't', '桶': 't',
  '统': 't', '痛': 't', '头': 't', '透': 't', '突': 't', '图': 't', '徒': 't', '土': 't',
  '吐': 't', '兔': 't', '团': 't', '推': 't', '腿': 't', '退': 't', '吞': 't', '脱': 't',
  '驼': 't', '妥': 't', '瓦': 'w', '外': 'w', '弯': 'w', '湾': 'w', '丸': 'w', '完': 'w',
  '玩': 'w', '晚': 'w', '碗': 'w', '万': 'w', '王': 'w', '网': 'w', '往': 'w', '望': 'w',
  '威': 'w', '微': 'w', '危': 'w', '违': 'w', '围': 'w', '为': 'w', '伟': 'w', '卫': 'w',
  '温': 'w', '文': 'w', '闻': 'w', '稳': 'w', '问': 'w', '我': 'w', '握': 'w', '乌': 'w',
  '屋': 'w', '无': 'w', '吴': 'w', '武': 'w', '五': 'w', '舞': 'w', '物': 'w', '误': 'w',
  '西': 'x', '昔': 'x', '惜': 'x', '席': 'x', '洗': 'x', '系': 'x', '细': 'x', '下': 'x',
  '夏': 'x', '先': 'x', '仙': 'x', '鲜': 'x', '纤': 'x', '咸': 'x', '贤': 'x', '显': 'x',
  '险': 'x', '现': 'x', '线': 'x', '限': 'x', '宪': 'x', '乡': 'x', '相': 'x', '香': 'x',
  '详': 'x', '祥': 'x', '想': 'x', '响': 'x', '项': 'x', '消': 'x', '宵': 'x', '晓': 'x',
  '小': 'x', '效': 'x', '校': 'x', '笑': 'x', '些': 'x', '歇': 'x', '协': 'x', '斜': 'x',
  '鞋': 'x', '心': 'x', '新': 'x', '欣': 'x', '星': 'x', '腥': 'x', '刑': 'x', '行': 'x',
  '形': 'x', '醒': 'x', '姓': 'x', '幸': 'x', '性': 'x', '凶': 'x', '胸': 'x', '秀': 'x',
  '袖': 'x', '虚': 'x', '须': 'x', '许': 'x', '叙': 'x', '绪': 'x', '续': 'x', '宣': 'x',
  '玄': 'x', '旋': 'x', '学': 'x', '雪': 'x', '血': 'x', '寻': 'x', '训': 'x', '讯': 'x',
  '压': 'y', '鸭': 'y', '崖': 'y', '哑': 'y', '雅': 'y', '亚': 'y', '烟': 'y', '淹': 'y',
  '延': 'y', '严': 'y', '言': 'y', '岩': 'y', '沿': 'y', '炎': 'y', '研': 'y', '盐': 'y',
  '颜': 'y', '眼': 'y', '演': 'y', '宴': 'y', '艳': 'y', '验': 'y', '雁': 'y', '燕': 'y',
  '央': 'y', '秧': 'y', '杨': 'y', '羊': 'y', '阳': 'y', '养': 'y', '腰': 'y', '摇': 'y',
  '咬': 'y', '药': 'y', '要': 'y', '耀': 'y', '爷': 'y', '也': 'y', '业': 'y', '叶': 'y',
  '页': 'y', '夜': 'y', '一': 'y', '伊': 'y', '衣': 'y', '医': 'y', '依': 'y', '仪': 'y',
  '宜': 'y', '姨': 'y', '移': 'y', '遗': 'y', '乙': 'y', '以': 'y', '蚁': 'y', '椅': 'y',
  '义': 'y', '艺': 'y', '议': 'y', '异': 'y', '译': 'y', '易': 'y', '疫': 'y', '益': 'y',
  '意': 'y', '毅': 'y', '忆': 'y', '因': 'y', '阴': 'y', '音': 'y', '姻': 'y', '吟': 'y',
  '银': 'y', '引': 'y', '隐': 'y', '印': 'y', '应': 'y', '英': 'y', '婴': 'y', '鹰': 'y',
  '迎': 'y', '盈': 'y', '营': 'y', '颖': 'y', '影': 'y', '映': 'y', '硬': 'y', '拥': 'y',
  '永': 'y', '泳': 'y', '勇': 'y', '用': 'y', '优': 'y', '悠': 'y', '尤': 'y', '邮': 'y',
  '犹': 'y', '油': 'y', '游': 'y', '友': 'y', '有': 'y', '又': 'y', '右': 'y', '幼': 'y',
  '诱': 'y', '与': 'y', '予': 'y', '余': 'y', '鱼': 'y', '娱': 'y', '渔': 'y', '于': 'y',
  '榆': 'y', '屿': 'y', '宇': 'y', '羽': 'y', '玉': 'y', '育': 'y', '语': 'y', '郁': 'y',
  '狱': 'y', '御': 'y', '裕': 'y', '遇': 'y', '愈': 'y', '誉': 'y', '豫': 'y', '元': 'y',
  '原': 'y', '员': 'y', '远': 'y', '愿': 'y', '曰': 'y', '约': 'y', '月': 'y', '越': 'y',
  '乐': 'y', '跃': 'y', '云': 'y', '匀': 'y', '允': 'y', '运': 'y', '韵': 'y', '杂': 'z',
  '灾': 'z', '宰': 'z', '载': 'z', '再': 'z', '在': 'z', '咱': 'z', '暂': 'z', '早': 'z',
  '灶': 'z', '造': 'z', '则': 'z', '择': 'z', '泽': 'z', '责': 'z', '贼': 'z', '怎': 'z',
  '增': 'z', '赠': 'z', '扎': 'z', '闸': 'z', '眨': 'z', '炸': 'z', '摘': 'z', '宅': 'z',
  '窄': 'z', '债': 'z', '占': 'z', '战': 'z', '张': 'z', '章': 'z', '掌': 'z', '丈': 'z',
  '帐': 'z', '招': 'z', '找': 'z', '照': 'z', '遮': 'z', '折': 'z', '者': 'z', '这': 'z',
  '浙': 'z', '珍': 'z', '真': 'z', '阵': 'z', '镇': 'z', '争': 'z', '征': 'z', '整': 'z',
  '正': 'z', '证': 'z', '政': 'z', '之': 'z', '支': 'z', '知': 'z', '织': 'z', '脂': 'z',
  '执': 'z', '直': 'z', '值': 'z', '止': 'z', '纸': 'z', '指': 'z', '至': 'z', '志': 'z',
  '制': 'z', '治': 'z', '质': 'z', '智': 'z', '中': 'z', '忠': 'z', '终': 'z', '钟': 'z',
  '肿': 'z', '重': 'z', '周': 'z', '州': 'z', '昼': 'z', '朱': 'z', '珠': 'z', '竹': 'z',
  '烛': 'z', '逐': 'z', '主': 'z', '住': 'z', '助': 'z', '注': 'z', '驻': 'z', '抓': 'z',
  '专': 'z', '转': 'z', '赚': 'z', '庄': 'z', '装': 'z', '壮': 'z', '准': 'z', '桌': 'z',
  '着': 'z', '仔': 'z', '子': 'z', '自': 'z', '字': 'z', '总': 'z', '走': 'z', '奏': 'z',
  '租': 'z', '足': 'z', '族': 'z', '祖': 'z', '组': 'z', '钻': 'z', '嘴': 'z', '最': 'z',
  '罪': 'z', '尊': 'z', '昨': 'z', '左': 'z', '坐': 'z', '座': 'z'
};

function getPinyinInitialSimple(str) {
  if (!str || typeof str !== 'string') return '';
  let result = '';
  for (let i = 0; i < str.length; i++) {
    const char = str[i];
    if (PINYIN_INITIAL_MAP[char]) {
      result += PINYIN_INITIAL_MAP[char];
    } else if (/[a-zA-Z]/.test(char)) {
      result += char.toLowerCase();
    } else if (/[0-9]/.test(char)) {
      result += char;
    } else {
      result += char;
    }
  }
  return result;
}

// ==================== 年龄计算函数 ====================
/**
 * 根据出生日期或身份证号计算年龄
 * @param {Object} patient - 患者对象
 * @returns {number|null} 年龄（岁），无法计算返回null
 */
function calculateAge(patient) {
  let birthDate = null;
  
  // 优先使用 birthDate 字段
  if (patient.birthDate && patient.birthDate.trim() !== '') {
    birthDate = new Date(patient.birthDate);
  }
  // 如果没有 birthDate，尝试从身份证号提取
  else if (patient.idCard && patient.idCard.trim() !== '') {
    const idCard = patient.idCard.trim();
    // 18位身份证：第7-14位是YYYYMMDD
    if (idCard.length === 18 || idCard.length === 15) {
      let year, month, day;
      if (idCard.length === 18) {
        year = parseInt(idCard.substring(6, 10));
        month = parseInt(idCard.substring(10, 12)) - 1; // JS月份从0开始
        day = parseInt(idCard.substring(12, 14));
      } else {
        // 15位身份证：第7-12位是YYMMDD（需要加上19）
        year = 1900 + parseInt(idCard.substring(6, 8));
        month = parseInt(idCard.substring(8, 10)) - 1;
        day = parseInt(idCard.substring(10, 12));
      }
      birthDate = new Date(year, month, day);
    }
  }
  
  if (!birthDate || isNaN(birthDate.getTime())) {
    return null;
  }
  
  // 计算年龄
  const today = new Date();
  let age = today.getFullYear() - birthDate.getFullYear();
  const monthDiff = today.getMonth() - birthDate.getMonth();
  
  // 如果今年还没过生日，年龄减1
  if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birthDate.getDate())) {
    age--;
  }
  
  return age >= 0 ? age : null;
}
// ==================== 应用初始化 ====================
const port = process.env.PORT || 3081;
const host = process.env.HOST || '0.0.0.0';

const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 8 * 1024 * 1024 } });

app.use((req, res, next) => {
  const origin = req.headers.origin;
  if (origin) {
    res.setHeader('Access-Control-Allow-Origin', origin);
    res.setHeader('Access-Control-Allow-Credentials', 'true');
  }
  if (req.method === 'OPTIONS') {
    res.setHeader('Access-Control-Allow-Methods', 'GET,POST,PUT,PATCH,DELETE,OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
    return res.sendStatus(204);
  }
  next();
});

// 访问日志中间件 — 仅记录API请求，排除静态资源和高频轮询
app.use((req, res, next) => {
  const start = Date.now();
  const originalSend = res.send;
  res.send = function(data) {
    res.send = originalSend;
    return res.send(data);
  };

  res.on('finish', () => {
    // 仅记录API路径，排除静态资源
    const urlPath = req.originalUrl || req.url;
    if (!urlPath.startsWith('/api/')) return;
    // 排除高频轮询接口（健康检查、提醒轮询等）
    if (urlPath.match(/\/api\/(health|reminders|assessments\?)/i) && res.statusCode < 400) return;

    const duration = Date.now() - start;
    const ip = getClientIp(req);
    const userAgent = req.headers['user-agent'] || '';

    // 记录访问日志
    store.addLog({
      level: res.statusCode >= 400 ? 'warn' : 'info',
      method: req.method,
      path: urlPath,
      ip: ip,
      userId: req.session && req.session.userId || '',
      username: req.session && req.session.username || '',
      action: 'ACCESS',
      targetType: 'SYSTEM',
      targetId: '',
      details: `${req.method} ${urlPath} ${res.statusCode} - ${duration}ms`,
      userAgent: userAgent
    });
  });

  next();
});

app.get('/api/health', (req, res) => {
  res.json({ ok: true, port, time: new Date().toISOString() });
});

app.use(express.static(path.join(__dirname, 'public')));
app.use(bodyParser.json({ limit: '2mb' }));
app.use(
  session({
    name: 'hdnursing.sid',
    secret: process.env.SESSION_SECRET || 'hd-dialysis-nursing-change-in-production',
    resave: false,
    saveUninitialized: false,
    cookie: {
      httpOnly: true,
      maxAge: 7 * 24 * 60 * 60 * 1000,
      sameSite: 'lax',
    },
  })
);

async function currentUser(req) {
  if (!req.session.userId) return null;
  return await store.getUserById(req.session.userId);
}

/** 统一获取客户端IP（支持代理头） */
function getClientIp(req) {
  return req.headers['x-forwarded-for']?.split(',')[0]?.trim()
    || req.connection?.remoteAddress
    || req.ip
    || '';
}

/** 统一获取User-Agent */
function getClientUA(req) {
  return req.headers['user-agent'] || '';
}

function userHasPermission(u, key) {
  if (!u) return false;
  if (u.role === 'admin') return true;
  if (u.status !== 'active') return false;
  const p = u.permissions || store.defaultDoctorPermissions();
  return p[key] !== false;
}

function userCanViewPatients(u) {
  return userHasPermission(u, 'viewPatients') || userHasPermission(u, 'managePatients');
}

async function requireAuth(req, res, next) {
  const u = await currentUser(req);
  if (!u) return res.status(401).json({ error: '请先登录' });
  if (u.role !== 'admin' && u.status === 'pending') {
    return res.status(403).json({ error: '账号待管理员审核通过后方可使用' });
  }
  if (u.role !== 'admin' && u.status === 'rejected') {
    return res.status(403).json({ error: '注册未通过审核，请联系管理员' });
  }
  if (u.role !== 'admin' && u.status === 'inactive') {
    return res.status(403).json({ error: '账号已被禁用，请联系管理员' });
  }
  next();
}

async function requireAdmin(req, res, next) {
  const u = await currentUser(req);
  if (!u) return res.status(401).json({ error: '请先登录' });
  if (u.role !== 'admin') return res.status(403).json({ error: '需要管理员权限' });
  next();
}

function requirePerm(key) {
  return async (req, res, next) => {
    const u = await currentUser(req);
    if (!u) return res.status(401).json({ error: '请先登录' });
    if (!userHasPermission(u, key)) return res.status(403).json({ error: '无权限执行此操作' });
    next();
  };
}

function serializeUser(u) {
  if (!u) return null;
  return {
    id: u.id,
    username: u.username,
    displayName: u.displayName,
    role: u.role,
    status: u.status,
    permissions: u.permissions || store.defaultDoctorPermissions(),
  };
}

/**
 * 重新计算单个患者的评估时间和评分
 * @param {string} patientId - 患者ID
 */
async function recalculatePatientNextAssessmentDue(patientId) {
  try {
    console.log(`[DEBUG] 开始重新计算患者评估时间 (patientId=${patientId})`);
    
    const patient = await store.getPatient(patientId);
    if (!patient) {
      console.log(`[DEBUG] 患者不存在 (patientId=${patientId})`);
      return;
    }
    
    console.log(`[DEBUG] 找到患者: ${patient.name} (patientId=${patientId})`);
    
    const assessments = await store.listAssessmentsForPatient(patientId);
    
    if (assessments && assessments.length > 0) {
      console.log(`[DEBUG] 患者有 ${assessments.length} 条评估记录`);
      
      // 按评估时间排序，获取最新的评估记录
      assessments.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
      const latestAssessment = assessments[0];
      
      // 重新计算评分结果
      const updatedRubric = await rubricLib.loadRubric();
      const { totalScore } = rubricLib.scoreFromAnswers(updatedRubric, JSON.parse(latestAssessment.answers));
      
      // 重新确定评估级别
      const newLevel = rubricLib.resolveLevel(updatedRubric, totalScore);
      
      // 计算新的评估频率和下次评估时间
      const freqDays = rubricLib.frequencyDaysForLevel(updatedRubric, newLevel, patient);
      const nextDue = rubricLib.nextDueIso(latestAssessment.createdAt, freqDays);
      
      // 更新患者信息
      patient.latestScore = totalScore;
      patient.lastLevelId = newLevel.id;
      patient.nextAssessmentDue = nextDue;
      
      console.log(`[DEBUG] 准备保存患者数据: latestScore=${totalScore}, lastLevelId=${newLevel.id}, nextAssessmentDue=${nextDue}`);
      
      await store.savePatient(patient);
      
      console.log(`[DEBUG] 患者数据保存成功 (patientId=${patientId})`);
    } else {
      console.log(`[DEBUG] 患者没有评估记录，清除相关字段`);
      
      // 没有评估记录，清除相关字段
      patient.latestScore = null;
      patient.lastLevelId = null;
      patient.nextAssessmentDue = null;
      
      console.log(`[DEBUG] 准备保存患者数据: latestScore=null, lastLevelId=null, nextAssessmentDue=null`);
      
      await store.savePatient(patient);
      
      console.log(`[DEBUG] 患者数据保存成功 (patientId=${patientId})`);
    }
  } catch (e) {
    console.error('[DEBUG] 重新计算患者评估时间失败 (patientId=' + patientId + '):', e);
  }
}

async function recalculateAllPatientsNextAssessmentDue() {
  try {
    const patients = await store.listPatients();
    const updatedRubric = await rubricLib.loadRubric();
    
    for (const patient of patients) {
      if (patient.lastAssessmentAt) {
        // 获取患者的最新评估记录
        const assessments = await store.listAssessmentsForPatient(patient.id);
        if (assessments && assessments.length > 0) {
          // 按评估时间排序，获取最新的评估记录
          assessments.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
          const latestAssessment = assessments[0];
          
          // 重新计算评分结果
          const { totalScore } = rubricLib.scoreFromAnswers(updatedRubric, JSON.parse(latestAssessment.answers));
          
          // 重新确定评估级别
          const newLevel = rubricLib.resolveLevel(updatedRubric, totalScore);
          
          // 计算新的评估频率和下次评估时间
          const freqDays = rubricLib.frequencyDaysForLevel(updatedRubric, newLevel, patient);
          const nextDue = rubricLib.nextDueIso(latestAssessment.createdAt, freqDays);
          
          // 更新患者信息
          patient.latestScore = totalScore;
          patient.lastLevelId = newLevel.id;
          patient.nextAssessmentDue = nextDue;
          
          await store.savePatient(patient);
        }
      }
    }
  } catch (e) {
    console.error('更新患者评估信息失败:', e);
  }
}

app.get('/api/rubric', async (req, res) => {
  try {
    const rubric = await rubricLib.loadRubric();
    res.json(rubric);
  } catch (e) {
    res.status(500).json({ error: '加载评分表失败' });
  }
});

// 评分级别相关 API
app.get('/api/rubric/levels', requireAuth, requireAdmin, async (req, res) => {
  try {
    const rubric = await rubricLib.loadRubric();
    res.json(rubric.levelRules || []);
  } catch (e) {
    res.status(500).json({ error: '加载评分级别失败' });
  }
});

app.post('/api/rubric/levels', requireAuth, requireAdmin, async (req, res) => {
  try {
    const rubric = await rubricLib.loadRubric();
    const body = req.body || {};
    
    const newLevel = {
      id: body.id || 'level_' + Date.now(),
      name: body.name || '',
      minScore: body.minScore || 0,
      maxScore: body.maxScore || 100,
      defaultFrequencyDays: body.defaultFrequencyDays || 30,
      color: body.color || '#999',
      description: body.description || ''
    };
    
    rubric.levelRules = rubric.levelRules || [];
    rubric.levelRules.push(newLevel);
    
    await rubricLib.saveRubric(rubric);
    
    await recalculateAllPatientsNextAssessmentDue();

    const u = await currentUser(req);
    store.addLog({
      level: 'info',
      method: 'POST',
      path: '/api/rubric/levels',
      ip: getClientIp(req),
      userId: u?.id || '',
      username: u?.username || '',
      action: 'CREATE',
      targetType: 'LEVEL',
      targetId: newLevel.id,
      details: `新增评分级别: ${newLevel.name} (${newLevel.minScore}-${newLevel.maxScore}分)`,
      userAgent: getClientUA(req)
    });

    res.json(newLevel);
  } catch (e) {
    res.status(500).json({ error: '添加评分级别失败' });
  }
});

app.put('/api/rubric/levels/:id', requireAuth, requireAdmin, async (req, res) => {
  try {
    const rubric = await rubricLib.loadRubric();
    const levelId = req.params.id;
    const body = req.body || {};
    
    const levelIndex = rubric.levelRules.findIndex(l => l.id === levelId);
    if (levelIndex === -1) {
      return res.status(404).json({ error: '评分级别不存在' });
    }
    
    const oldLevel = { ...rubric.levelRules[levelIndex] };
    rubric.levelRules[levelIndex] = {
      ...rubric.levelRules[levelIndex],
      name: body.name || rubric.levelRules[levelIndex].name,
      minScore: body.minScore != null ? body.minScore : rubric.levelRules[levelIndex].minScore,
      maxScore: body.maxScore != null ? body.maxScore : rubric.levelRules[levelIndex].maxScore,
      defaultFrequencyDays: body.defaultFrequencyDays != null ? body.defaultFrequencyDays : rubric.levelRules[levelIndex].defaultFrequencyDays,
      color: body.color || rubric.levelRules[levelIndex].color,
      description: body.description !== undefined ? body.description : rubric.levelRules[levelIndex].description
    };
    
    await rubricLib.saveRubric(rubric);
    
    await recalculateAllPatientsNextAssessmentDue();

    const u = await currentUser(req);
    store.addLog({
      level: 'info',
      method: 'PUT',
      path: `/api/rubric/levels/${levelId}`,
      ip: getClientIp(req),
      userId: u?.id || '',
      username: u?.username || '',
      action: 'UPDATE',
      targetType: 'LEVEL',
      targetId: levelId,
      details: `更新评分级别: ${oldLevel.name} → ${rubric.levelRules[levelIndex].name} (${rubric.levelRules[levelIndex].minScore}-${rubric.levelRules[levelIndex].maxScore}分)`,
      userAgent: getClientUA(req)
    });

    res.json(rubric.levelRules[levelIndex]);
  } catch (e) {
    res.status(500).json({ error: '更新评分级别失败' });
  }
});

app.delete('/api/rubric/levels/:id', requireAuth, requireAdmin, async (req, res) => {
  try {
    const rubric = await rubricLib.loadRubric();
    const levelId = req.params.id;
    
    const initialLength = rubric.levelRules.length;
    const deletedLevel = rubric.levelRules.find(l => l.id === levelId);
    rubric.levelRules = rubric.levelRules.filter(l => l.id !== levelId);
    
    if (rubric.levelRules.length === initialLength) {
      return res.status(404).json({ error: '评分级别不存在' });
    }
    
    await rubricLib.saveRubric(rubric);
    
    // 重新计算所有患者的评估时间
    await recalculateAllPatientsNextAssessmentDue();

    const u = await currentUser(req);
    store.addLog({
      level: 'warn',
      method: 'DELETE',
      path: `/api/rubric/levels/${levelId}`,
      ip: getClientIp(req),
      userId: u?.id || '',
      username: u?.username || '',
      action: 'DELETE',
      targetType: 'LEVEL',
      targetId: levelId,
      details: `删除评分级别: ${deletedLevel?.name || levelId} (${deletedLevel?.minScore}-${deletedLevel?.maxScore}分)`,
      userAgent: getClientUA(req)
    });

    res.json({ ok: true });
  } catch (e) {
    res.status(500).json({ error: '删除评分级别失败' });
  }
});

// 患者信息字段设置 API
app.get('/api/settings/patient-fields', requireAuth, requireAdmin, (req, res) => {
  try {
    const fields = store.getPatientFields();
    res.json(fields);
  } catch (e) {
    res.status(500).json({ error: '加载患者信息字段设置失败' });
  }
});

// 公开的患者字段配置API（不需要权限，用于导出模板）
app.get('/api/patient-fields-config', async (req, res) => {
  try {
    const fields = store.getPatientFields();
    res.json(fields);
  } catch (e) {
    res.status(500).json({ error: '加载患者信息字段设置失败' });
  }
});

app.post('/api/settings/patient-fields', requireAuth, requireAdmin, (req, res) => {
  try {
    const fields = req.body || [];
    const result = store.savePatientFields(fields);
    if (result) {
      const u = store.getUserByIdSync?.(req.session?.userId);
      store.addLog({
        level: 'info',
        method: 'POST',
        path: '/api/settings/patient-fields',
        ip: getClientIp(req),
        userId: req.session?.userId || '',
        username: req.session?.username || '',
        action: 'UPDATE_SETTINGS',
        targetType: 'SETTINGS',
        targetId: '',
        details: `保存患者字段设置，共${Array.isArray(fields) ? fields.length : 0}个字段`,
        userAgent: getClientUA(req)
      });
      res.json({ ok: true });
    } else {
      res.status(500).json({ error: '保存患者信息字段设置失败' });
    }
  } catch (e) {
    res.status(500).json({ error: '保存患者信息字段设置失败' });
  }
});

app.post('/api/auth/register', async (req, res) => {
  const { username, password, displayName } = req.body || {};
  if (!username || !password) {
    return res.status(400).json({ error: '请输入用户名和密码' });
  }
  if (String(username).length < 2 || String(password).length < 6) {
    return res.status(400).json({ error: '用户名至少2字符，密码至少6位' });
  }
  
  // 检查用户名是否已存在
  const trimmedUsername = String(username).trim();
  const existingUser = await store.getUserByUsername(trimmedUsername);
  if (existingUser) {
    return res.status(400).json({ error: '用户名已被占用，请选择其他用户名' });
  }
  
  const passwordHash = await bcrypt.hash(String(password), 10);
  const result = await store.createPendingDoctor({
    username: trimmedUsername,
    passwordHash,
    displayName: displayName ? String(displayName).trim() : '',
  });
  if (!result.ok) return res.status(400).json({ error: result.error });

  store.addLog({
    level: 'info',
    method: 'POST',
    path: '/api/auth/register',
    ip: getClientIp(req),
    userId: '',
    username: trimmedUsername,
    action: 'REGISTER',
    targetType: 'USER',
    targetId: result.id || '',
    details: `新用户注册: ${trimmedUsername}${displayName ? ' (' + String(displayName).trim() + ')' : ''}`,
    userAgent: getClientUA(req)
  });

  res.json({
    ok: true,
    message: '注册信息已提交，需管理员审核通过后方可登录系统',
  });
});

app.post('/api/auth/login', async (req, res) => {
  const { username, password } = req.body || {};
  const usernameStr = String(username || '').trim();
  const ip = getClientIp(req);

  try {
    const user = await store.getUserByUsername(usernameStr);
    if (!user || !(await bcrypt.compare(String(password || ''), user.passwordHash))) {
      logger.warn('登录失败：用户名或密码错误', { username: usernameStr, ip: req.ip });
      store.addLog({
        level: 'warn',
        method: 'POST',
        path: '/api/auth/login',
        ip: ip,
        username: usernameStr,
        action: 'LOGIN_FAILED',
        targetType: 'AUTH',
        details: '用户名或密码错误',
        userAgent: getClientUA(req)
      });
      return res.status(401).json({ error: '用户名或密码错误' });
    }
    if (user.role !== 'admin' && user.status === 'pending') {
      logger.warn('登录失败：账号待审核', { username: usernameStr, userId: user.id });
      store.addLog({
        level: 'warn',
        method: 'POST',
        path: '/api/auth/login',
        ip: ip,
        username: usernameStr,
        userId: user.id,
        action: 'LOGIN_FAILED',
        targetType: 'AUTH',
        details: '账号待审核',
        userAgent: getClientUA(req)
      });
      return res.status(403).json({ error: '账号待管理员审核通过后方可登录' });
    }
    if (user.role !== 'admin' && user.status === 'rejected') {
      logger.warn('登录失败：注册未通过审核', { username: usernameStr, userId: user.id });
      store.addLog({
        level: 'warn',
        method: 'POST',
        path: '/api/auth/login',
        ip: ip,
        username: usernameStr,
        userId: user.id,
        action: 'LOGIN_FAILED',
        targetType: 'AUTH',
        details: '注册未通过审核',
        userAgent: getClientUA(req)
      });
      return res.status(403).json({ error: '注册未通过审核' });
    }
    if (user.role !== 'admin' && user.status === 'inactive') {
      logger.warn('登录失败：账号已被禁用', { username: usernameStr, userId: user.id });
      store.addLog({
        level: 'warn',
        method: 'POST',
        path: '/api/auth/login',
        ip: ip,
        username: usernameStr,
        userId: user.id,
        action: 'LOGIN_FAILED',
        targetType: 'AUTH',
        details: '账号已被禁用',
        userAgent: getClientUA(req)
      });
      return res.status(403).json({ error: '账号已被禁用，请联系管理员' });
    }
    req.session.userId = user.id;
    req.session.username = user.username;
    logger.info('登录成功', { username: usernameStr, userId: user.id, role: user.role, ip: req.ip });
    store.addLog({
      level: 'info',
      method: 'POST',
      path: '/api/auth/login',
      ip: ip,
      userId: user.id,
      username: user.username,
      action: 'LOGIN_SUCCESS',
      targetType: 'AUTH',
      details: `登录成功，角色: ${user.role}`,
      userAgent: getClientUA(req)
    });
    res.json({ user: serializeUser(user) });
  } catch (error) {
    logger.error('登录过程出错', { username: usernameStr, error: error.message });
    res.status(500).json({ error: '登录过程出错' });
  }
});

app.post('/api/auth/logout', (req, res) => {
  const userId = req.session.userId;
  const username = req.session.username;
  const ip = getClientIp(req);
  req.session.destroy(() => {
    logger.info('退出登录成功', { userId });
    store.addLog({
      level: 'info',
      method: 'POST',
      path: '/api/auth/logout',
      ip: ip,
      userId: userId,
      username: username,
      action: 'LOGOUT',
      targetType: 'AUTH',
      details: '用户退出登录',
      userAgent: getClientUA(req)
    });
    res.json({ ok: true });
  });
});

app.post('/api/auth/change-password', requireAuth, async (req, res) => {
  const u = await currentUser(req);
  const { currentPassword, newPassword } = req.body || {};
  
  if (!currentPassword || !newPassword) {
    return res.status(400).json({ error: '请输入当前密码和新密码' });
  }
  
  if (String(newPassword).length < 6) {
    return res.status(400).json({ error: '新密码至少6位' });
  }
  
  if (!(await bcrypt.compare(String(currentPassword), u.passwordHash))) {
    return res.status(401).json({ error: '当前密码错误' });
  }
  
  const newPasswordHash = await bcrypt.hash(String(newPassword), 10);
  const r = await store.updateUserPassword(u.id, newPasswordHash);
  if (!r.ok) return res.status(400).json({ error: r.error });
  
  logger.info('密码修改成功', { userId: u.id, username: u.username });
  store.addLog({
    level: 'info',
    method: 'POST',
    path: '/api/auth/change-password',
    ip: getClientIp(req),
    userId: u.id,
    username: u.username,
    action: 'CHANGE_PASSWORD',
    targetType: 'AUTH',
    targetId: u.id,
    details: '用户自行修改密码',
    userAgent: getClientUA(req)
  });
  res.json({ ok: true, message: '密码修改成功' });
});

app.get('/api/auth/me', async (req, res) => {
  const u = await currentUser(req);
  if (!u) return res.json({ user: null });
  res.json({ user: serializeUser(u) });
});

app.get('/api/admin/users', requireAuth, requireAdmin, async (req, res) => {
  res.json(await store.listUsers());
});

app.post('/api/admin/users/:id/approve', requireAuth, requireAdmin, async (req, res) => {
  const u = await store.getUserById(req.params.id);
  if (!u) return res.status(404).json({ error: '用户不存在' });
  if (u.role === 'admin') return res.status(400).json({ error: '不能审核管理员账号' });
  if (u.status !== 'pending') return res.status(400).json({ error: '该用户不是待审核状态' });
  const r = await store.updateUserById(u.id, { status: 'active' });

  const admin = await currentUser(req);
  store.addLog({
    level: 'info',
    method: 'POST',
    path: `/api/admin/users/${req.params.id}/approve`,
    ip: getClientIp(req),
    userId: admin?.id || '',
    username: admin?.username || '',
    action: 'APPROVE_USER',
    targetType: 'USER',
    targetId: u.id,
    details: `审批通过用户: ${u.username}${u.displayName ? ' (' + u.displayName + ')' : ''}`,
    userAgent: getClientUA(req)
  });

  res.json(r.user);
});

app.post('/api/admin/users/:id/reject', requireAuth, requireAdmin, async (req, res) => {
  const u = await store.getUserById(req.params.id);
  if (!u) return res.status(404).json({ error: '用户不存在' });
  if (u.role === 'admin') return res.status(400).json({ error: '不能拒绝管理员账号' });
  if (u.status !== 'pending') return res.status(400).json({ error: '该用户不是待审核状态' });
  const r = await store.updateUserById(u.id, { status: 'rejected' });

  const admin = await currentUser(req);
  store.addLog({
    level: 'warn',
    method: 'POST',
    path: `/api/admin/users/${req.params.id}/reject`,
    ip: getClientIp(req),
    userId: admin?.id || '',
    username: admin?.username || '',
    action: 'REJECT_USER',
    targetType: 'USER',
    targetId: u.id,
    details: `拒绝用户注册: ${u.username}${u.displayName ? ' (' + u.displayName + ')' : ''}`,
    userAgent: getClientUA(req)
  });

  res.json(r.user);
});

app.patch('/api/admin/users/:id', requireAuth, requireAdmin, async (req, res) => {
  const u = await store.getUserById(req.params.id);
  if (!u) return res.status(404).json({ error: '用户不存在' });
  if (u.role === 'admin') return res.status(400).json({ error: '管理员权限为全部功能，无需在此调整' });
  const body = req.body || {};
  const patch = {};
  if (body.permissions && typeof body.permissions === 'object') patch.permissions = body.permissions;
  if (body.displayName != null) patch.displayName = body.displayName;
  if (body.status != null) patch.status = body.status;
  const r = await store.updateUserById(u.id, patch);
  if (!r.ok) return res.status(400).json({ error: r.error });

  const admin = await currentUser(req);
  store.addLog({
    level: 'info',
    method: 'PATCH',
    path: `/api/admin/users/${req.params.id}`,
    ip: getClientIp(req),
    userId: admin?.id || '',
    username: admin?.username || '',
    action: 'UPDATE_USER',
    targetType: 'USER',
    targetId: u.id,
    details: `修改用户: ${u.username}，变更: ${Object.keys(patch).join(', ')}`,
    userAgent: getClientUA(req)
  });

  res.json(r.user);
});

app.post('/api/admin/users/:id/reset-password', requireAuth, requireAdmin, async (req, res) => {
  const u = await store.getUserById(req.params.id);
  if (!u) return res.status(404).json({ error: '用户不存在' });
  if (u.role === 'admin') return res.status(400).json({ error: '不能重置管理员密码' });
  const passwordHash = await bcrypt.hash('123456', 10);
  const r = await store.updateUserPassword(u.id, passwordHash);
  if (!r.ok) return res.status(400).json({ error: r.error });

  const admin = await currentUser(req);
  store.addLog({
    level: 'warn',
    method: 'POST',
    path: `/api/admin/users/${req.params.id}/reset-password`,
    ip: getClientIp(req),
    userId: admin?.id || '',
    username: admin?.username || '',
    action: 'RESET_PASSWORD',
    targetType: 'USER',
    targetId: u.id,
    details: `重置用户密码: ${u.username}`,
    userAgent: getClientUA(req)
  });

  res.json({ ok: true, message: '密码已重置为 123456' });
});

app.post('/api/admin/users/:id/change-password', requireAuth, requireAdmin, async (req, res) => {
  const u = await store.getUserById(req.params.id);
  if (!u) return res.status(404).json({ error: '用户不存在' });
  if (u.role === 'admin') return res.status(400).json({ error: '不能修改管理员密码' });
  const body = req.body || {};
  const newPassword = String(body.newPassword || '').trim();
  if (!newPassword) return res.status(400).json({ error: '请输入新密码' });
  const passwordHash = await bcrypt.hash(newPassword, 10);
  const r = await store.updateUserPassword(u.id, passwordHash);
  if (!r.ok) return res.status(400).json({ error: r.error });

  const admin = await currentUser(req);
  store.addLog({
    level: 'warn',
    method: 'POST',
    path: `/api/admin/users/${req.params.id}/change-password`,
    ip: getClientIp(req),
    userId: admin?.id || '',
    username: admin?.username || '',
    action: 'CHANGE_PASSWORD',
    targetType: 'USER',
    targetId: u.id,
    details: `管理员修改用户密码: ${u.username}`,
    userAgent: getClientUA(req)
  });

  res.json({ ok: true, message: '密码修改成功' });
});

// 删除用户账号
app.delete('/api/admin/users/:id', requireAuth, requireAdmin, async (req, res) => {
  const u = await store.getUserById(req.params.id);
  if (!u) return res.status(404).json({ error: '用户不存在' });
  if (u.role === 'admin') return res.status(400).json({ error: '不能删除管理员账号' });
  
  try {
    const result = await store.deleteUser(u.id);
    if (!result.ok) return res.status(400).json({ error: result.error });
    
    const ip = getClientIp(req);
    logger.warn('删除用户账号', { userId: req.session.userId, targetUserId: u.id, username: u.username });
    store.addLog({
      level: 'warn',
      method: 'DELETE',
      path: `/api/admin/users/${req.params.id}`,
      ip: ip,
      userId: req.session.userId,
      username: req.session.username || '',
      action: 'DELETE',
      targetType: 'USER',
      targetId: u.id,
      details: `删除用户账号: ${u.username} (${u.displayName || ''})`,
      userAgent: getClientUA(req)
    });
    
    res.json({ ok: true, message: '用户账号已删除' });
  } catch (e) {
    console.error('删除用户失败:', e);
    res.status(500).json({ error: '删除失败', message: e.message });
  }
});

app.get('/api/dashboard', requireAuth, requirePerm('viewDashboard'), async (req, res) => {
  const rubric = await rubricLib.loadRubric();
  const patients = await store.listPatients();
  const assessments = await store.listAllAssessments();
  const now = Date.now();

  const byLevel = { low: 0, medium: 0, high: 0, unknown: 0 };
  const overdue = [];
  const dueSoon = [];

  for (const p of patients) {
    const last = assessments
      .filter((a) => a.patientId === p.id)
      .sort((a, b) => new Date(b.assessedAt) - new Date(a.assessedAt))[0];
    const lid = (last && last.levelId) || p.lastLevelId || 'unknown';
    if (byLevel[lid] != null) byLevel[lid]++;
    else byLevel.unknown++;

    const due = p.nextAssessmentDue ? new Date(p.nextAssessmentDue).getTime() : null;
    if (due != null) {
      if (due < now) overdue.push({ patient: summarizePatient(p), dueAt: p.nextAssessmentDue });
      else if (due < now + 7 * 24 * 60 * 60 * 1000) dueSoon.push({ patient: summarizePatient(p), dueAt: p.nextAssessmentDue });
    }
  }

  overdue.sort((a, b) => new Date(a.dueAt) - new Date(b.dueAt));
  dueSoon.sort((a, b) => new Date(a.dueAt) - new Date(b.dueAt));

  const users = await store.listUsers();
  res.json({
    rubricTitle: rubric.title,
    totals: {
      patients: patients.length,
      assessments: assessments.length,
      doctors: users.filter((x) => x.role === 'doctor').length,
    },
    byLevel,
    overdue: overdue.slice(0, 50),
    dueSoon: dueSoon.slice(0, 50),
  });
});

function summarizePatient(p) {
  return {
    id: p.id,
    name: p.name,
    gender: p.gender,
    phone: p.phone,
    lastAssessmentAt: p.lastAssessmentAt,
    nextAssessmentDue: p.nextAssessmentDue,
    latestScore: p.latestScore,
    lastLevelId: p.lastLevelId,
  };
}

async function requirePatientAccess(req, res, next) {
  const u = await currentUser(req);
  if (!u) return res.status(401).json({ error: '请先登录' });
  if (!userCanViewPatients(u)) return res.status(403).json({ error: '无权限查看患者信息' });
  next();
}

app.get('/api/patients', requireAuth, requirePatientAccess, async (req, res) => {
  const rawList = await store.listPatients();
  console.log(`[DEBUG] /api/patients 返回 ${rawList.length} 条记录`);
  if (rawList.length > 0) {
    console.log('[DEBUG] 第一条患者数据:', JSON.stringify(rawList[0]));
  }
  // 确保每条记录都有 id 字段（放在 ...p 之后，覆盖 p.id if needed）
  const list = rawList.map((p) => {
    // 防护：如果id和patientNo都为空，为其生成一个新id
    let safeId = p.id || p.patientNo || '';
    if (!safeId) {
      console.warn('[WARN] 患者记录缺少id和patientNo，将自动生成:', p.name);
      safeId = store.uid('p');
    }
    return {
      ...p,
      id: safeId,
      assessmentFrequencyDays: p.assessmentFrequencyDays ?? null,
    };
  });
  list.sort((a, b) => new Date(b.updatedAt || b.createdAt) - new Date(a.updatedAt || a.createdAt));
  res.json(list);
});

// 新版API：返回患者列表及其最新评估信息（动态计算，不存储）
app.get('/api/patients/with-assessments', requireAuth, requirePatientAccess, async (req, res) => {
  try {
    const patients = await store.listPatients();
    const rubric = await rubricLib.loadRubric();
    
    const result = await Promise.all(patients.map(async (patient) => {
      // 获取患者的最新评估记录
      const assessments = await store.listAssessmentsForPatient(patient.id);
      let latestScore = null;
      let lastLevelId = null;
      let lastAssessmentAt = null;
      let nextAssessmentDue = null;
      
      if (assessments && assessments.length > 0) {
        // 按评估时间排序，获取最新的评估记录
        assessments.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
        const latestAssessment = assessments[0];
        
        // 重新计算评分结果
        const scoreResult = rubricLib.scoreFromAnswers(rubric, JSON.parse(latestAssessment.answers || '{}'));
        latestScore = scoreResult.totalScore;
        
        // 重新确定评估级别
        const level = rubricLib.resolveLevel(rubric, latestScore);
        lastLevelId = level.id;
        
        // 计算下次评估时间
        const freqDays = rubricLib.frequencyDaysForLevel(rubric, level, patient);
        nextAssessmentDue = rubricLib.nextDueIso(latestAssessment.createdAt, freqDays);
        lastAssessmentAt = latestAssessment.createdAt;
      }
      
      return {
        id: patient.id || patient._id,  // 确保返回 id 字段
        age: calculateAge(patient),  // 自动计算年龄
        ...patient,
        latestScore,
        lastLevelId,
        lastAssessmentAt,
        nextAssessmentDue,
      };
    }));
    
    result.sort((a, b) => new Date(b.updatedAt || b.createdAt) - new Date(a.updatedAt || a.createdAt));
    res.json(result);
  } catch (e) {
    console.error('获取患者评估信息失败:', e);
    res.status(500).json({ error: '获取患者评估信息失败' });
  }
});

app.post('/api/patients', requireAuth, requirePerm('managePatients'), async (req, res) => {
  const u = await currentUser(req);
  const body = req.body || {};
  const name = String(body.name || '').trim();
  if (!name) return res.status(400).json({ error: '请填写患者姓名' });
  
  if (!body.phone || !body.phone.trim()) {
    return res.status(400).json({ error: '请填写联系电话' });
  }
  
  if (!body.firstDialysisDate) {
    return res.status(400).json({ error: '请填写首次透析日期' });
  }
  
  // 校验首次透析日期：不能早于出生日期，不能晚于当前系统日期
  if (body.firstDialysisDate) {
    const birthDate = body.birthDate ? new Date(body.birthDate) : null;
    const firstDialysisDate = new Date(body.firstDialysisDate);
    const today = new Date();
    
    // 清空时间部分，只比较日期
    if (birthDate) birthDate.setHours(0, 0, 0, 0);
    firstDialysisDate.setHours(0, 0, 0, 0);
    today.setHours(0, 0, 0, 0);
    
    // 检查首次透析日期是否早于出生日期
    if (birthDate && firstDialysisDate < birthDate) {
      return res.status(400).json({ error: '首次透析日期不能早于患者出生日期' });
    }
    
    // 检查首次透析日期是否晚于当前系统日期
    if (firstDialysisDate > today) {
      return res.status(400).json({ error: '首次透析日期不能晚于当前系统日期' });
    }
  }
  
  // 检查身份证号码是否重复
  if (body.idCard) {
    const existingPatients = await store.listPatients();
    const duplicateIdCard = existingPatients.find(p => p.idCard === body.idCard);
    if (duplicateIdCard) {
      return res.status(400).json({ error: '该身份证号码已存在，不能重复添加患者' });
    }
  }
  
  // 获取下一个可用的患者编号（格式：p000001）
  const patientNo = body.patientNo || await store.getNextPatientNo();
  console.log(`[DEBUG] 新增患者，生成患者编号: ${patientNo}`);
  
  // 生成患者ID（格式：p_16位随机字符串）
  const patientId = store.generatePatientId();
  console.log(`[DEBUG] 新增患者，生成患者ID: ${patientId}`);

  const patient = {
    id: patientId,
    patientNo,
    name,
    gender: body.gender || '',
    birthDate: body.birthDate || '',
    phone: body.phone || '',
    idCard: body.idCard || '',
    dialysisId: body.dialysisId || '',
    bedNo: body.bedNo || '',
    firstDialysisDate: body.firstDialysisDate || '',
    height: body.height || '',
    dryWeight: body.dryWeight || '',
    preWeight: body.preWeight || '',
    notes: body.notes || '',
    assessmentFrequencyDays:
      body.assessmentFrequencyDays != null && body.assessmentFrequencyDays !== ''
        ? Math.max(1, parseInt(body.assessmentFrequencyDays, 10) || 0)
        : null,
    lastAssessmentAt: null,
    nextAssessmentDue: null,
    lastLevelId: null,
    latestScore: null,
    createdBy: u.id,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
  await store.savePatient(patient);

  const ip = getClientIp(req);
  store.addLog({
    level: 'info',
    method: 'POST',
    path: '/api/patients',
    ip: ip,
    userId: u.id,
    username: u.username,
    action: 'CREATE',
    targetType: 'PATIENT',
    targetId: patient.id,
    details: `添加患者: ${patient.name} (编号: ${patientNo})`,
    userAgent: getClientUA(req)
  });

  res.json(patient);
});

app.put('/api/patients/:id', requireAuth, requirePerm('managePatients'), async (req, res) => {
  const u = await currentUser(req);
  const p = await store.getPatient(req.params.id);
  if (!p || !p.id) {
    console.log('[DEBUG] PUT /api/patients/:id - 患者不存在, id:', req.params.id);
    return res.status(404).json({ error: '患者不存在' });
  }
  console.log('[DEBUG] PUT /api/patients/:id - 开始更新患者, id:', p.id, ', patientNo:', p.patientNo, ', name:', p.name);
  console.log('[DEBUG] PUT /api/patients/:id - 请求体:', JSON.stringify(req.body));
  
  const body = req.body || {};
  
  // 验证必填字段
  if (body.name != null && !String(body.name).trim()) {
    return res.status(400).json({ error: '患者姓名不能为空' });
  }
  if (body.phone != null && !body.phone.trim()) {
    return res.status(400).json({ error: '联系电话不能为空' });
  }
  if (body.firstDialysisDate != null && !body.firstDialysisDate) {
    return res.status(400).json({ error: '首次透析日期不能为空' });
  }
  
  // 校验首次透析日期：不能早于出生日期，不能晚于当前系统日期
  const checkFirstDialysisDate = body.firstDialysisDate != null ? body.firstDialysisDate : p.firstDialysisDate;
  const checkBirthDate = body.birthDate != null ? body.birthDate : p.birthDate;
  
  if (checkFirstDialysisDate) {
    const birthDate = checkBirthDate ? new Date(checkBirthDate) : null;
    const firstDialysisDate = new Date(checkFirstDialysisDate);
    const today = new Date();
    
    // 清空时间部分，只比较日期
    if (birthDate) birthDate.setHours(0, 0, 0, 0);
    firstDialysisDate.setHours(0, 0, 0, 0);
    today.setHours(0, 0, 0, 0);
    
    // 检查首次透析日期是否早于出生日期
    if (birthDate && firstDialysisDate < birthDate) {
      return res.status(400).json({ error: '首次透析日期不能早于患者出生日期' });
    }
    
    // 检查首次透析日期是否晚于当前系统日期
    if (firstDialysisDate > today) {
      return res.status(400).json({ error: '首次透析日期不能晚于当前系统日期' });
    }
  }
  
  if (body.name != null) p.name = String(body.name).trim() || p.name;
  // 不允许修改身份证号码、id和patientNo
  if (body.id !== undefined) delete body.id;
  if (body.patientNo !== undefined) delete body.patientNo;
  
  // 检查身份证号码是否重复（更新时允许保持原身份证号码）
  if (body.idCard && body.idCard !== p.idCard) {
    const existingPatients = await store.listPatients();
    const duplicateIdCard = existingPatients.find(existing => 
      existing.idCard === body.idCard && existing.id !== p.id
    );
    if (duplicateIdCard) {
      return res.status(400).json({ error: '该身份证号码已存在，不能重复使用' });
    }
  }
  
  ['gender', 'birthDate', 'phone', 'dialysisId', 'bedNo', 'firstDialysisDate', 'height', 'dryWeight', 'preWeight', 'notes'].forEach((k) => {
    if (body[k] != null) p[k] = body[k];
  });
  if (body.assessmentFrequencyDays !== undefined) {
    if (body.assessmentFrequencyDays === '' || body.assessmentFrequencyDays == null) {
      p.assessmentFrequencyDays = null;
    } else {
      p.assessmentFrequencyDays = Math.max(1, parseInt(body.assessmentFrequencyDays, 10) || 30);
    }
  }
  p.updatedAt = new Date().toISOString();
  console.log('[DEBUG] PUT /api/patients/:id - 准备保存患者:', JSON.stringify(p));
  await store.savePatient(p);
  console.log('[DEBUG] PUT /api/patients/:id - 保存成功, id:', p.id);
  
  const ip = getClientIp(req);
  store.addLog({
    level: 'info',
    method: 'PUT',
    path: `/api/patients/${req.params.id}`,
    ip: ip,
    userId: u.id,
    username: u.username,
    action: 'UPDATE',
    targetType: 'PATIENT',
    targetId: p.id,
    details: `更新患者信息: ${p.name} (编号: ${p.patientNo})`,
    userAgent: getClientUA(req)
  });

  res.json(p);
});

app.delete('/api/patients/:id', requireAuth, requirePerm('deletePatients'), async (req, res) => {
  const u = await currentUser(req);
  const p = await store.getPatient(req.params.id);
  if (!p) return res.status(404).json({ error: '患者不存在' });
  await store.deletePatient(req.params.id);

  const ip = getClientIp(req);
  store.addLog({
    level: 'warn',
    method: 'DELETE',
    path: `/api/patients/${req.params.id}`,
    ip: ip,
    userId: u.id,
    username: u.username,
    action: 'DELETE',
    targetType: 'PATIENT',
    targetId: p.id,
    details: `删除患者: ${p.name} (编号: ${p.patientNo})`,
    userAgent: getClientUA(req)
  });

  res.json({ ok: true });
});

function normalizeHeader(cell) {
  return String(cell || '')
    .trim()
    // 去除模板中用于标注必填的装饰符号（★ * ※ ● 等），以及前后空格
    .replace(/^[★*※●◆▶►✦✧#＊﹡]+/, '')
    .trim()
    .replace(/\s/g, '')
    .toLowerCase();
}

function pickRow(row, keys) {
  const out = {};
  const norm = {};
  for (const k of Object.keys(row)) {
    norm[normalizeHeader(k)] = row[k];
  }
  for (const [field, aliases] of Object.entries(keys)) {
    for (const a of aliases) {
      const v = norm[normalizeHeader(a)];
      if (v != null && String(v).trim() !== '') {
        out[field] = String(v).trim();
        break;
      }
    }
  }
  return out;
}

app.post(
  '/api/patients/import',
  requireAuth,
  requirePerm('importPatients'),
  requirePerm('managePatients'),
  upload.single('file'),
  async (req, res) => {
  const u = await currentUser(req);
  if (!req.file) return res.status(400).json({ error: '请上传 Excel 文件（.xlsx / .xls）' });

  let workbook;
  try {
    workbook = xlsx.read(req.file.buffer, { type: 'buffer', cellDates: true });
  } catch (e) {
    return res.status(400).json({ error: '无法解析该 Excel 文件' });
  }
  const sheetName = workbook.SheetNames[0];
  const sheet = workbook.Sheets[sheetName];
  const rows = xlsx.utils.sheet_to_json(sheet, { defval: '' });
  if (!rows.length) return res.status(400).json({ error: '表格为空' });

  const keyMap = {
    name: ['姓名', '患者姓名', 'name'],
    gender: ['性别', 'gender'],
    birthDate: ['出生日期', '生日', 'birth', 'birthdate'],
    phone: ['电话', '手机', '联系电话', 'phone', 'tel'],
    idCard: ['身份证', '身份证号', 'idcard'],
    dialysisId: ['透析号', '病历号', '门诊号', 'dialysis'],
    bedNo: ['床号', '床位', 'bed'],
    firstDialysisDate: ['首次透析日期', '首次透析', '透析开始日期'],
    height: ['身高'],
    dryWeight: ['干体重'],
    preWeight: ['透前体重'],
    notes: ['备注', '说明', 'notes'],
  };

  const imported = [];
  const errors = [];
  
  // 获取所有现有患者，用于检查身份证号码重复
  const existingPatients = await store.listPatients();
  
  for (let i = 0; i < rows.length; i++) {
    const raw = rows[i];

    // 跳过说明行/示例行/空行
    // 判断依据：
    //   1. 第一个非空单元格值包含"必填"、"示例"、"说明"等关键词
    //   2. 第一个非空单元格值以 ※ 开头（示例数据标识）
    //   3. 所有值均为空
    const allValues = Object.values(raw).map(v => String(v || '').trim());
    const firstNonEmpty = allValues.find(v => v !== '') || '';
    const isDescriptionRow = /必填|示例|说明|填项|请勿|模板|import/i.test(firstNonEmpty)
      || allValues.every(v => v === '')
      || firstNonEmpty.startsWith('※');
    if (isDescriptionRow) continue;

    // 清除单元格值中的 ※ 前缀（用户可能未删除示例行但修改了数据，仍保留 ※ 标记的视为示例数据）
    const cleanedRaw = {};
    for (const k of Object.keys(raw)) {
      const val = String(raw[k] || '').trim();
      cleanedRaw[k] = val.startsWith('※') ? val.substring(1) : val;
    }

    const picked = pickRow(cleanedRaw, keyMap);
    const name = (picked.name || '').trim();
    if (!name) {
      errors.push({ row: i + 2, message: '缺少姓名' });
      continue;
    }

    // 身份证号码格式验证（含校验码，与前端 validateIdCardStrict 保持一致）
    if (picked.idCard) {
      const idCard = picked.idCard.trim();
      const idCard18 = /^\d{17}[\dXx]$/.test(idCard);
      const idCard15 = /^\d{15}$/.test(idCard);
      if (!idCard18 && !idCard15) {
        errors.push({ row: i + 2, message: `身份证号码格式不正确：${idCard}（需18位或15位）` });
        continue;
      }
      // 18位身份证额外校验：校验码验证
      if (idCard18) {
        const factor = [7, 9, 10, 5, 8, 4, 2, 1, 6, 3, 7, 9, 10, 5, 8, 4, 2];
        const checkCodes = ['1', '0', 'X', '9', '8', '7', '6', '5', '4', '3', '2'];
        let sum = 0;
        for (let ci = 0; ci < 17; ci++) {
          sum += parseInt(idCard.charAt(ci), 10) * factor[ci];
        }
        const expectedCheck = checkCodes[sum % 11];
        const actualCheck = idCard.charAt(17).toUpperCase();
        if (actualCheck !== expectedCheck) {
          errors.push({ row: i + 2, message: `身份证号码校验码不正确（最后一位应为"${expectedCheck}"）：${idCard}` });
          continue;
        }
      }
    }

    // 检查身份证号码是否重复
    if (picked.idCard) {
      const duplicateIdCard = existingPatients.find(p => p.idCard === picked.idCard);
      if (duplicateIdCard) {
        errors.push({ row: i + 2, message: `身份证号码已存在（患者：${duplicateIdCard.name}）` });
        continue;
      }
    }

    // 根据身份证号自动提取出生日期和性别
    let autoBirthDate = '';
    let autoGender = '';
    if (picked.idCard) {
      const idCard = picked.idCard.trim();
      if (idCard.length === 18) {
        // 18位身份证：第7-14位是YYYYMMDD，第17位奇数=男，偶数=女
        autoBirthDate = `${idCard.substring(6,10)}-${idCard.substring(10,12)}-${idCard.substring(12,14)}`;
        autoGender = parseInt(idCard.charAt(16)) % 2 === 1 ? '男' : '女';
      } else if (idCard.length === 15) {
        // 15位身份证：第7-12位是YYMMDD（需加19），第15位奇数=男，偶数=女
        autoBirthDate = `19${idCard.substring(6,8)}-${idCard.substring(8,10)}-${idCard.substring(10,12)}`;
        autoGender = parseInt(idCard.charAt(14)) % 2 === 1 ? '男' : '女';
      }
    }

    // 日期字段格式标准化：将 2023/5/4、2023.5.4 等转为 YYYY-MM-DD
    function normalizeDate(d) {
      // 处理 xlsx cellDates: true 返回的 Date 对象
      if (d instanceof Date) {
        const y = d.getFullYear();
        const m = String(d.getMonth() + 1).padStart(2, '0');
        const day = String(d.getDate()).padStart(2, '0');
        return `${y}-${m}-${day}`;
      }
      if (!d) return '';
      const s = String(d).trim();
      // 已经是标准格式
      if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return s;
      // 斜杠或点分隔：2023/5/4 或 2023.5.4
      const m = s.match(/^(\d{4})[\/.](\d{1,2})[\/.](\d{1,2})$/);
      if (m) return `${m[1]}-${m[2].padStart(2,'0')}-${m[3].padStart(2,'0')}`;
      // 尝试 Date 解析作为兜底
      const dt = new Date(s);
      if (!isNaN(dt.getTime())) return dt.toISOString().slice(0, 10);
      return s;
    }

    // 标准化首次透析日期
    const normalizedFirstDialysisDate = normalizeDate(picked.firstDialysisDate);

    // 首次透析日期校验（与手动添加患者保持一致）
    if (!normalizedFirstDialysisDate) {
      errors.push({ row: i + 2, message: '缺少首次透析日期' });
      continue;
    }

    // 校验首次透析日期格式有效性
    const fddObj = new Date(normalizedFirstDialysisDate);
    if (isNaN(fddObj.getTime())) {
      errors.push({ row: i + 2, message: `首次透析日期格式无效：${picked.firstDialysisDate}` });
      continue;
    }

    // 校验首次透析日期不能早于出生日期
    const effectiveBirthDate = autoBirthDate || normalizeDate(picked.birthDate);
    if (effectiveBirthDate) {
      const bdObj = new Date(effectiveBirthDate);
      if (!isNaN(bdObj.getTime())) {
        fddObj.setHours(0, 0, 0, 0);
        bdObj.setHours(0, 0, 0, 0);
        if (fddObj < bdObj) {
          errors.push({ row: i + 2, message: `首次透析日期（${normalizedFirstDialysisDate}）不能早于出生日期（${effectiveBirthDate}）` });
          continue;
        }
      }
    }

    // 校验首次透析日期不能晚于当前系统日期
    const todayCheck = new Date();
    todayCheck.setHours(0, 0, 0, 0);
    const fddForTodayCheck = new Date(normalizedFirstDialysisDate);
    fddForTodayCheck.setHours(0, 0, 0, 0);
    if (fddForTodayCheck > todayCheck) {
      errors.push({ row: i + 2, message: `首次透析日期（${normalizedFirstDialysisDate}）不能晚于当前系统日期` });
      continue;
    }

    // 自动生成patientNo
    const patientNo = await store.getNextPatientNo();

    const patient = {
      id: store.generatePatientId(),
      patientNo,
      name,
      // 优先使用身份证号自动提取的值，若用户也填了则以身份证号提取为准
      gender: autoGender || picked.gender || '',
      birthDate: autoBirthDate || normalizeDate(picked.birthDate),
      phone: picked.phone || '',
      idCard: picked.idCard || '',
      dialysisId: picked.dialysisId || '',
      bedNo: picked.bedNo || '',
      firstDialysisDate: normalizedFirstDialysisDate,
      height: picked.height || '',
      dryWeight: picked.dryWeight || '',
      preWeight: picked.preWeight || '',
      notes: picked.notes || '',
      assessmentFrequencyDays: null,
      lastAssessmentAt: null,
      nextAssessmentDue: null,
      lastLevelId: null,
      createdBy: u.id,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    store.savePatient(patient);
    imported.push(patient);
  }

  // 记录导入操作日志
  store.addLog({
    level: 'info',
    method: 'POST',
    path: '/api/patients/import',
    ip: getClientIp(req),
    userId: u.id,
    username: u.username,
    action: 'IMPORT',
    targetType: 'PATIENT',
    details: `批量导入患者：成功${imported.length}条，失败${errors.length}条`,
    userAgent: getClientUA(req)
  });

  res.json({ imported: imported.length, errors, patients: imported });
  }
);

app.get('/api/patients/:id/assessments', requireAuth, requirePatientAccess, async (req, res) => {
  const p = await store.getPatient(req.params.id);
  if (!p) return res.status(404).json({ error: '患者不存在' });
  const assessments = await store.listAssessmentsForPatient(p.id);
  // 转换createdAt字段为assessedAt字段，确保前端能正确显示评估时间
  const transformedAssessments = assessments.map(a => ({
    ...a,
    assessedAt: a.createdAt,
    doctorId: a.assessorId,
    doctorName: a.assessorName
  }));
  // 按照评估时间排序
  const list = transformedAssessments.sort((a, b) => new Date(b.assessedAt) - new Date(a.assessedAt));
  res.json(list);
});

app.post('/api/patients/:id/assessments', requireAuth, requirePerm('scorePatients'), async (req, res) => {
  try {
    // 1. 加载评分规则
    const rubric = await rubricLib.loadRubric();
    
    // 2. 获取患者信息
    const p = await store.getPatient(req.params.id);
    if (!p) return res.status(404).json({ error: '患者不存在' });
    
    // 3. 获取当前用户
    const u = await currentUser(req);
    
    // 4. 处理请求数据
    const body = req.body || {};
    const answers = body.answers || {};
    
    // 5. 计算评分
    const { totalScore, scores } = rubricLib.scoreFromAnswers(rubric, answers);
    
    // 6. 确定评估级别
    const level = rubricLib.resolveLevel(rubric, totalScore);
    
    // 7. 计算下次评估时间
    const freqDays = rubricLib.frequencyDaysForLevel(rubric, level, p);
    const assessedAt = body.assessedAt ? new Date(body.assessedAt).toISOString() : new Date().toISOString();
    const nextDue = rubricLib.nextDueIso(assessedAt, freqDays);

    // 8. 创建评估记录
    const assessment = {
      id: store.uid('a'),
      patientId: p.id,
      doctorId: u.id,
      doctorName: u.displayName || u.username,
      answers,
      scores,
      totalScore,
      levelId: level.id,
      levelName: level.name,
      levelColor: level.color,
      frequencyDaysUsed: freqDays,
      assessedAt,
      remark: body.remark || '',
      nextAssessmentDue: nextDue,
    };
    
    // 9. 保存评估记录
    await store.addAssessment(assessment);

    // 10. 更新患者信息
    p.lastAssessmentAt = assessedAt;
    p.nextAssessmentDue = nextDue;
    p.lastLevelId = level.id;
    p.latestScore = totalScore;
    p.updatedAt = new Date().toISOString();
    // 确保patient对象有patientNo属性
    if (!p.patientNo) {
      p.patientNo = '';
    }
    await store.savePatient(p);

    // 11. 记录操作日志
    const ip = getClientIp(req);
    const patientDetails = p.patientNo ? `患者 ${p.name} (编号: ${p.patientNo})` : `患者 ${p.name}`;
    store.addLog({
      level: 'info',
      method: 'POST',
      path: `/api/patients/${req.params.id}/assessments`,
      ip: ip,
      userId: u.id,
      username: u.username,
      action: 'ASSESS',
      targetType: 'ASSESSMENT',
      targetId: assessment.id,
      details: `${patientDetails} 评估得分: ${totalScore}, 分级: ${level.name}`,
      userAgent: getClientUA(req)
    });

    // 12. 返回响应
    res.json({ 
      assessment: { 
        id: assessment.id, 
        patientId: assessment.patientId, 
        totalScore: assessment.totalScore, 
        levelId: assessment.levelId, 
        levelName: assessment.levelName, 
        assessedAt: assessment.assessedAt, 
        nextAssessmentDue: nextDue
      }, 
      patient: { 
        id: p.id, 
        name: p.name, 
        lastAssessmentAt: p.lastAssessmentAt, 
        nextAssessmentDue: p.nextAssessmentDue, 
        lastLevelId: p.lastLevelId, 
        latestScore: p.latestScore 
      } 
    });
  } catch (e) {
    console.error('评估提交失败:', e);
    // 即使出现错误，也要返回适当的响应
    res.status(500).json({ 
      error: '评估提交失败，请重试', 
      message: e.message 
    });
  }
});

app.get('/api/reminders', requireAuth, requirePerm('viewDashboard'), async (req, res) => {
  console.log('[DEBUG] /api/reminders 被调用');
  const patients = await store.listPatients();
  const now = Date.now();
  const overdue = [];
  const upcoming = [];
  
  // 动态重新计算所有患者的nextAssessmentDue
  const rubric = await rubricLib.loadRubric();
  console.log(`[DEBUG] 加载评分规则，共 ${rubric.levelRules?.length || 0} 个级别`);
  
  for (const p of patients) {
    // 获取患者的最新评估记录
    const assessments = await store.listAssessmentsForPatient(p.id);
    if (assessments && assessments.length > 0) {
      // 按评估时间排序，获取最新的评估记录
      assessments.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
      const latestAssessment = assessments[0];
      console.log(`[DEBUG] 患者 ${p.name} (id=${p.id}): 找到 ${assessments.length} 条评估记录, 最新记录id=${latestAssessment.id}`);
      
      // 重新计算评分结果
      const { totalScore } = rubricLib.scoreFromAnswers(rubric, JSON.parse(latestAssessment.answers));
      
      // 重新确定评估级别
      const newLevel = rubricLib.resolveLevel(rubric, totalScore);
      
      console.log(`[DEBUG] 患者 ${p.name} (id=${p.id}): 总分=${totalScore}, 旧级别=${p.lastLevelId}, 新级别=${newLevel?.id}`);
      
      // 计算新的评估频率和下次评估时间
      const freqDays = rubricLib.frequencyDaysForLevel(rubric, newLevel, p);
      const nextDue = rubricLib.nextDueIso(new Date(latestAssessment.createdAt), freqDays);
      
      // 更新患者的nextAssessmentDue和lastLevelId
      p.nextAssessmentDue = nextDue;
      p.lastLevelId = newLevel?.id || p.lastLevelId;
      p.lastAssessmentAt = p.lastAssessmentAt || latestAssessment.createdAt;
      await store.savePatient(p);
      console.log(`[DEBUG] 患者 ${p.name} 已更新: lastLevelId=${p.lastLevelId}, nextAssessmentDue=${p.nextAssessmentDue}`);
    } else {
      console.log(`[DEBUG] 患者 ${p.name} (id=${p.id}) 无评估记录，跳过重新计算`);
    }
    
    if (!p.nextAssessmentDue) continue;
    const t = new Date(p.nextAssessmentDue).getTime();
    const patientSummary = summarizePatient(p);
    console.log(`[DEBUG] 患者 ${p.name} 的 summarizePatient 结果:`, patientSummary);
    const item = { patient: patientSummary, dueAt: p.nextAssessmentDue, daysLeft: Math.ceil((t - now) / (24 * 60 * 60 * 1000)) };
    if (t < now) overdue.push(item);
    else upcoming.push(item);
  }
  
  overdue.sort((a, b) => new Date(a.dueAt) - new Date(b.dueAt));
  upcoming.sort((a, b) => new Date(a.dueAt) - new Date(b.dueAt));
  console.log(`[DEBUG] /api/reminders 返回: ${overdue.length} 个逾期, ${upcoming.length} 个待评`);
  res.json({ overdue, upcoming });
});

app.get('/api/doctors', requireAuth, requireAdmin, async (req, res) => {
  const users = await store.listUsers();
  const doctors = users.filter(u => u.role === 'doctor' && u.status === 'active');
  res.json(doctors);
});

app.get('/api/assessments', requireAuth, async (req, res) => {
  const assessments = await store.listAllAssessments();
  // 转换createdAt字段为assessedAt字段，确保前端能正确显示评估时间
  const transformedAssessments = assessments.map(a => ({
    ...a,
    assessedAt: a.createdAt,
    doctorId: a.assessorId,
    doctorName: a.assessorName
  }));
  res.json(transformedAssessments);
});

// 删除单条评估记录
app.delete('/api/assessments/:id', requireAuth, requirePerm('deleteRecords'), async (req, res) => {
  try {
    console.log(`[DEBUG] 收到删除评估记录请求 (id=${req.params.id})`);
    
    const u = await currentUser(req);
    const allAssessments = await store.listAllAssessments();
    const assessment = allAssessments.find(a => String(a.id) === String(req.params.id));
    if (!assessment) {
      console.log(`[DEBUG] 评估记录不存在 (id=${req.params.id})`);
      return res.status(404).json({ error: '评估记录不存在' });
    }
    
    console.log(`[DEBUG] 找到评估记录 (id=${req.params.id}, patientId=${assessment.patientId})`);
    
    await store.deleteAssessment(req.params.id);
    console.log(`[DEBUG] 评估记录已删除 (id=${req.params.id})`);
    
    // 重新计算患者的评估时间
    console.log(`[DEBUG] 开始重新计算患者评估时间 (patientId=${assessment.patientId})`);
    await recalculatePatientNextAssessmentDue(assessment.patientId);
    console.log(`[DEBUG] 患者评估时间重新计算完成 (patientId=${assessment.patientId})`);
    
    const ip = getClientIp(req);
    store.addLog({
      level: 'warn',
      method: 'DELETE',
      path: `/api/assessments/${req.params.id}`,
      ip,
      userId: u.id,
      username: u.username,
      action: 'DELETE',
      targetType: 'ASSESSMENT',
      targetId: String(req.params.id),
      details: `删除评估记录 id=${req.params.id}, 患者id=${assessment.patientId}, 得分=${assessment.totalScore}`,
      userAgent: getClientUA(req)
    });
    res.json({ ok: true });
  } catch (e) {
    console.error('[DEBUG] 删除评估记录失败:', e);
    res.status(500).json({ error: '删除失败', message: e.message });
  }
});

// 批量删除评估记录
app.post('/api/assessments/batch-delete', requireAuth, requirePerm('deleteRecords'), async (req, res) => {
  try {
    console.log(`[DEBUG] 收到批量删除评估记录请求 (ids=${JSON.stringify(req.body.ids)})`);
    
    const u = await currentUser(req);
    const { ids } = req.body || {};
    if (!Array.isArray(ids) || ids.length === 0) {
      console.log(`[DEBUG] 没有提供要删除的记录ID列表`);
      return res.status(400).json({ error: '请提供要删除的记录ID列表' });
    }
    
    console.log(`[DEBUG] 准备删除 ${ids.length} 条评估记录`);
    
    // 获取要删除的评估记录，以便知道哪些患者受影响
    const allAssessments = await store.listAllAssessments();
    const toDelete = allAssessments.filter(a => ids.includes(String(a.id)));
    const affectedPatientIds = [...new Set(toDelete.map(a => a.patientId))];
    
    console.log(`[DEBUG] 受影响的患者的ID: ${JSON.stringify(affectedPatientIds)}`);
    
    await store.deleteAssessmentsBatch(ids);
    console.log(`[DEBUG] 评估记录已删除 (ids=${JSON.stringify(ids)})`);
    
    // 重新计算每个受影响患者的评估时间
    for (const patientId of affectedPatientIds) {
      console.log(`[DEBUG] 开始重新计算患者评估时间 (patientId=${patientId})`);
      await recalculatePatientNextAssessmentDue(patientId);
      console.log(`[DEBUG] 患者评估时间重新计算完成 (patientId=${patientId})`);
    }
    
    const ip = getClientIp(req);
    store.addLog({
      level: 'warn',
      method: 'POST',
      path: '/api/assessments/batch-delete',
      ip,
      userId: u.id,
      username: u.username,
      action: 'DELETE',
      targetType: 'ASSESSMENT',
      targetId: ids.join(','),
      details: `批量删除评估记录 ids=[${ids.join(',')}] 共${ids.length}条`,
      userAgent: getClientUA(req)
    });
    res.json({ ok: true, deleted: ids.length });
  } catch (e) {
    console.error('批量删除评估记录失败:', e);
    res.status(500).json({ error: '批量删除失败', message: e.message });
  }
});

app.get('/api/assessments/:id', requireAuth, async (req, res) => {
  const assessments = await store.listAllAssessments();
  const assessment = assessments.find(a => a.id == req.params.id);
  if (!assessment) {
    return res.status(404).json({ error: '评估记录不存在' });
  }
  // 转换createdAt字段为assessedAt字段，确保前端能正确显示评估时间
  const transformedAssessment = {
    ...assessment,
    assessedAt: assessment.createdAt,
    doctorId: assessment.assessorId,
    doctorName: assessment.assessorName
  };
  res.json(transformedAssessment);
});

app.get('/api/patients/:id', requireAuth, requirePatientAccess, async (req, res) => {
  const patient = await store.getPatient(req.params.id);
  if (!patient) {
    return res.status(404).json({ error: '患者不存在' });
  }
  res.json(patient);
});

// 获取患者评估默认值（根据出生日期和首次透析日期自动计算年龄和透析龄）
app.get('/api/patients/:id/assessment-defaults', requireAuth, requirePatientAccess, async (req, res) => {
  try {
    const defaults = await store.getPatientAssessmentDefaults(req.params.id);
    res.json(defaults);
  } catch (e) {
    console.error('获取患者评估默认值失败:', e);
    res.status(400).json({ error: e.message || '获取评估默认值失败' });
  }
});

async function ensureBootstrapAdmin() {
  const users = await store.listUsers();
  let hasAdmin = users.some((u) => u.username === 'admin' && u.role === 'admin');
  const named = users.find((u) => u.username === 'admin');
  if (named && named.role !== 'admin') {
    named.role = 'admin';
    named.status = 'active';
    await store.saveUser(named);
    hasAdmin = true;
  }
  if (!hasAdmin) {
    const passwordHash = await bcrypt.hash('admin@123', 10);
    await store.createAdminUser({ username: 'admin', passwordHash, displayName: '系统管理员' });
    console.log('[安全提示] 已创建默认管理员 用户名 admin / 密码 admin@123，请登录后尽快修改密码。');
  }
}

// 日志查询API
app.get('/api/logs', requireAuth, requireAdmin, async (req, res) => {
  try {
    const options = {
      level: req.query.level,
      method: req.query.method,
      path: req.query.path,
      userId: req.query.userId,
      username: req.query.username,
      action: req.query.action,
      targetType: req.query.targetType,
      startDate: req.query.startDate,
      endDate: req.query.endDate,
      limit: req.query.limit ? parseInt(req.query.limit) : 100
    };
    const logs = await store.getLogs(options);
    res.json(logs);
  } catch (e) {
    console.error('获取日志失败:', e);
    res.status(500).json({ error: '获取日志失败' });
  }
});

ensureBootstrapAdmin().then(() => {
  const server = app.listen(port, host, () => {
    const interfaces = os.networkInterfaces();
    let lanIp = '<本机IP>';
    for (const name of Object.keys(interfaces)) {
      for (const iface of interfaces[name]) {
        if (iface.family === 'IPv4' && !iface.internal) {
          lanIp = iface.address;
          break;
        }
      }
      if (lanIp !== '<本机IP>') break;
    }
    const message = `血液透析患者分层分级管理系统已启动`;
    const details = {
      port,
      host,
      localAccess: `http://127.0.0.1:${port}`,
      lanAccess: `http://${lanIp}:${port}`
    };
    console.log(message);
    console.log(`  本机访问: http://127.0.0.1:${port}`);
    console.log(`  局域网访问: http://${lanIp}:${port} （勿双击打开 public/index.html）`);
    logger.info(message, details);
  });
  
  server.on('error', (err) => {
    console.error('服务器启动失败:', err.message);
    process.exit(1);
  });
});
