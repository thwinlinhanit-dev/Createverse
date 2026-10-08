/**
 * Simplified-character check for zh-Hant (P0-08; SAFETY.md §13, ADR-0008).
 *
 * The product ships Traditional Chinese only. This set lists high-frequency
 * characters that exist **only** in Simplified Chinese — each one has a
 * different Traditional codepoint (這 vs 这, 語 vs 语), so finding one means the
 * text was simplified somewhere.
 *
 * Characters that are valid in both scripts (干, 面, 里, 台, 只, 别, 复, 制, 后,
 * 液, 淡, 游 …) are deliberately excluded: flagging them would reject
 * legitimate Traditional text. A curated set keeps the check deterministic and
 * dependency-free; extend it when a real-world miss is found (every safety bug
 * becomes a permanent test — TESTING.md §1).
 */

const SIMPLIFIED_ONLY = `
这 说 语 读 写 时 会 来 个 们 对 开 关 还 从 图 车 东 马 鸟 风 电 权 亲 体 发
岁 变 动 员 总 断 厅 历 乐 药 钱 铁 针 医 饭 馆 爱 买 卖 书 学 觉 举 严 儿 农
击 义 欢 观 见 门 问 间 队 阶 阳 阴 阵 应 庆 产 亩 伞 传 伟 伤 伦 伪 兰 兴 兽
冲 决 况 净 凤 凯 创 刚 刘 则 剂 剑 办 务 势 区 协 单 卢 卫 厂 压 县 参 双 号
叹 吗 吨 听 启 呜 响 唤 喷 团 园 围 国 圆 场 坏 块 坚 坛 坟 垒 执 扩 扫 扬 报
担 拟 择 挥 换 损 摆 摄 拥 挤 挡 摇 拦 护 计 订 讨 训 讯 记 讲 许 论 设 访
证 评 识 诉 词 译 试 诗 诚 话 诞 询 该 详 误 请 诸 调 谈 谊 谋 谜 谨 谱 让
认
谢 课 谁 难 汉 汤 沟 沦 泪 泽 洁 测 济 浓 润 涨 渐 温 湿 满 潜 灭 灯 炉 烂
烧 烟 爷 牺 状 犹 狮 独 狭 猫 献 环 现 规 视 玛 贝 负 财 贤 货 质 贸 贺 赛
赠 赢 跃 转 软 轰 轻 较 辅 辆 辈 辉 边 迁 迈 运 违 迟 达 导 际 陆 陈 险 随
隐 鸡 鸣 鸭 鹅 麦 齿 龄 龙 乌 颜 额 页 顾 领 题 颗 飞 骂 骄 骑 骗 鱼 鲜 齐
党 旧 术 杀 杂 条 杨 构 枪 柜 标 栏 树 业 欧 歼 残 毕 毙 补 经 结 给 绝 红
络 统 继 续 编 缘 罗 罚 罢 聪 肃 脑 脸 舆 艺 节 苍 荐 获 蓝 虽 虾 蝇 装 争
亿 仅 仓 仪 优 价 贡 败 账 购 贮 钢 铃 铅 铜 银 铺 链 销 锁 锅 错 键 锻 镇
镜 长 呛 哗 喽 噜 嘱 囱 坝 坠 垦 堕 声 壳 处 备 够 头 夹 夺 奋 奖 奥 妆 妇
妈 婴 孙 宁 实 宠 审 宽 宾 寻 将 尘 尝 尧 届 层 属 峡 岗 崭 帐 帮 广 庄 库
庙 废 异 弃 张 弹 录 彻 径 忆 忧 态 恳 恶 恼 悬 惧 惨 惯 愿 戏 战 扑 扪 扰 抛
拢 拣 挣 捞 掳 掺 搀 擞 攒 敌 旷 晓 暂 枢 栋 榄 横 氢 汇 沧 泼 洒 浑 涛 涩
渗 溃 滤 滨 滥 滦 淀 烦 烨 焕 牍 狈 狰 猪 猎 玑 琐 瑶 玺 觅 览 讳 讶 讷 讽
讼 诀 诈 诊 诫 诲 诵 诺 谆 谍 谎 谐 谓 谣 谬 贞 贩 贫 贯 贱 贴 贷 赂 赃 赎
赐 赖 赣 趋 跷 踪 踊 躯 轨 载 辑 辙 辞 辽 递 逻 遗 邻 郑 释 锚 锯 镀 闭 闯
闷 闹 阁 阅 阎 阐 陕 隶 雏 鸥 鸦 鹏 鹤 鹦 龟 劲 劳 勋 币 帅 师 帘 帜 滩 澜
华 与 万 么 为 众 乱 数 检 网 简 习 适 过 进 远 连 桥 灵 养 专 职 选 宝 贵
资 饮 钥 怀 赚 赔 脚 类 预 验 组 织 范 绩 项 归 当 机 样 楼 线 级 细 终 练
点 热 饱 饿 裤 袜 钟 纸 叶 尔 种 粮 寿 军 劝 顺 须 帮 盖 锈 缓 飘 纪 驾 邮 驶
`.replace(/\s+/g, "");

const SIMPLIFIED_CHARS = new Set([...SIMPLIFIED_ONLY].filter((c) => c !== ""));

/** Unique simplified-only characters found in `text`, in order of appearance. */
export function findSimplifiedChars(text: string): string[] {
  const found: string[] = [];
  const seen = new Set<string>();
  for (const char of text) {
    if (SIMPLIFIED_CHARS.has(char) && !seen.has(char)) {
      seen.add(char);
      found.push(char);
    }
  }
  return found;
}
