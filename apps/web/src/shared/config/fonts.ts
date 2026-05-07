export const fontOptions = [
  {
    key: "balanced-sans",
    label: "均衡黑体",
    family: `"Microsoft YaHei UI", "PingFang SC", "Hiragino Sans GB", "Microsoft YaHei", sans-serif`
  },
  {
    key: "soft-ui",
    label: "雅黑正文",
    family: `"Microsoft YaHei", "PingFang SC", "Hiragino Sans GB", "Microsoft YaHei UI", sans-serif`
  },
  {
    key: "apple-first",
    label: "黑体醒目",
    family: `"SimHei", "Heiti SC", "PingFang SC", "Microsoft YaHei UI", sans-serif`
  },
  {
    key: "windows-first",
    label: "宋体衬线",
    family: `"SimSun", "Songti SC", "STSong", "Microsoft YaHei UI", serif`
  },
  {
    key: "compact-cn",
    label: "等线清爽",
    family: `"DengXian", "PingFang SC", "Hiragino Sans GB", "Microsoft YaHei UI", sans-serif`
  },
  {
    key: "clean-cn",
    label: "楷体温和",
    family: `"KaiTi", "Kaiti SC", "STKaiti", "Microsoft YaHei UI", serif`
  },
  {
    key: "classic-ui",
    label: "仿宋舒展",
    family: `"FangSong", "STFangsong", "Songti SC", "Microsoft YaHei UI", serif`
  },
  {
    key: "jhenghei",
    label: "正黑 UI",
    family: `"Microsoft JhengHei UI", "Microsoft JhengHei", "Microsoft YaHei UI", "PingFang SC", sans-serif`
  },
  {
    key: "dengxian",
    label: "等线",
    family: `"DengXian", "Microsoft YaHei UI", "Microsoft YaHei", "PingFang SC", sans-serif`
  }
] as const;

export type FontKey = (typeof fontOptions)[number]["key"];
export const defaultFontKey: FontKey = "balanced-sans";
