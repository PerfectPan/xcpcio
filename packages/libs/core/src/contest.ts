import type { Contest as IContest, Image, StatusTimeDisplay } from "@xcpcio/types";
import { ContestState } from "@xcpcio/types";

import type { Problem, Problems } from "./problem";
import { createProblems, createProblemsByProblemIds } from "./problem";
import { createDayJS, dayjs, getTimeDiff } from "./utils";
import { Group } from "./group";
import { Award } from "./award";
import { type Awards, MedalType } from "./award";
import { ContestOptions, createContestOptions } from "./contest-options";

export class Contest {
  name = "";

  startTime: dayjs.Dayjs;
  endTime: dayjs.Dayjs;
  freezeTime: dayjs.Dayjs;

  totalDurationTimestamp: number;
  freezeDurationTimestamp: number;
  unFreezeDurationTimestamp: number;

  penalty: number;

  problems: Problems;
  problemsMap: Map<string, Problem>;

  statusTimeDisplay: StatusTimeDisplay;

  badge?: string;
  medal?: Record<string, Record<string, number>>;
  awards?: Awards;
  organization?: string;

  group: Map<string, Group>;
  tag: Map<string, string>;

  logo?: Image;
  banner?: Image;
  boardLink?: string;

  options: ContestOptions;

  constructor() {
    this.startTime = createDayJS();
    this.endTime = createDayJS();
    this.freezeTime = createDayJS();

    this.totalDurationTimestamp = 0;
    this.freezeDurationTimestamp = 0;
    this.unFreezeDurationTimestamp = 0;

    // 20 mins
    this.penalty = 20 * 60;

    this.problems = [];
    this.problemsMap = new Map<string, Problem>();

    this.statusTimeDisplay = {
      correct: true,
      incorrect: true,
      pending: true,
    };

    this.group = new Map<string, Group>();
    this.tag = new Map<string, string>();

    this.options = new ContestOptions();
  }

  getContestDuration(timeFormat = "HH:mm:ss"): string {
    return dayjs.duration(this.endTime.diff(this.startTime)).format(timeFormat);
  }

  getContestState(nowTime?: Date): ContestState {
    const now = createDayJS(nowTime);

    if (now.isBefore(this.startTime)) {
      return ContestState.PENDING;
    }

    if (now.isSameOrAfter(this.endTime)) {
      return ContestState.FINISHED;
    }

    if (now.isSameOrAfter(this.freezeTime)) {
      return ContestState.FROZEN;
    }

    return ContestState.RUNNING;
  }

  getContestPendingTime(nowTime?: Date): string {
    let baseTime = createDayJS(nowTime);
    if (baseTime.isAfter(this.startTime)) {
      baseTime = this.startTime;
    }

    return getTimeDiff(Math.floor(dayjs.duration(this.startTime.diff(baseTime)).asSeconds()));
  }

  getContestElapsedTime(nowTime?: Date): string {
    let baseTime = createDayJS(nowTime);
    if (baseTime.isAfter(this.endTime)) {
      baseTime = this.endTime;
    }

    if (baseTime.isBefore(this.startTime)) {
      baseTime = this.startTime;
    }

    return getTimeDiff(Math.floor(dayjs.duration(baseTime.diff(this.startTime)).asSeconds()));
  }

  getContestRemainingTime(nowTime?: Date): string {
    let baseTime = createDayJS(nowTime);
    if (baseTime.isAfter(this.endTime)) {
      baseTime = this.endTime;
    }

    if (baseTime.isBefore(this.startTime)) {
      baseTime = this.startTime;
    }

    return getTimeDiff(Math.floor(dayjs.duration(this.endTime.diff(baseTime)).asSeconds()));
  }

  getContestProgressRatio(nowTime?: Date): number {
    const baseTime = createDayJS(nowTime);

    if (this.startTime.isSameOrAfter(baseTime)) {
      return 0;
    }

    if (this.endTime.isSameOrBefore(baseTime)) {
      return 100;
    }

    const total = this.endTime.diff(this.startTime, "s");
    const pass = baseTime.diff(this.startTime, "s");

    return Math.round((pass * 100) / total);
  }

  isEnableAwards(group: string): boolean {
    if (!this.awards) {
      return false;
    }

    if (!this.awards.has(group)) {
      return false;
    }

    return true;
  }
}

export function createContest(contestJSON: IContest): Contest {
  const c = new Contest();

  c.name = contestJSON.contest_name;

  c.startTime = createDayJS(contestJSON.start_time);
  c.endTime = createDayJS(contestJSON.end_time);

  c.totalDurationTimestamp = c.endTime.unix() - c.startTime.unix();

  {
    // default value
    c.freezeTime = c.endTime;
    c.freezeDurationTimestamp = 0;

    if (contestJSON.frozen_time !== undefined && contestJSON.frozen_time != null) {
      const frozenTime = Number(contestJSON.frozen_time);

      c.freezeTime = createDayJS(c.endTime.unix() - frozenTime);
      c.freezeDurationTimestamp = frozenTime;
    }

    if (contestJSON.freeze_time !== undefined && contestJSON.freeze_time !== null) {
      c.freezeTime = createDayJS(contestJSON.freeze_time);
      c.freezeDurationTimestamp = c.endTime.unix() - c.freezeTime.unix();
    }

    c.unFreezeDurationTimestamp = c.totalDurationTimestamp - c.freezeDurationTimestamp;
  }

  c.penalty = contestJSON.penalty;

  {
    if (contestJSON.problem_id !== undefined && contestJSON.problem_id !== null) {
      c.problems = createProblemsByProblemIds(contestJSON.problem_id, contestJSON.balloon_color);
    }

    if (contestJSON.problems !== undefined && contestJSON.problems !== null) {
      c.problems = createProblems(contestJSON.problems);
    }

    c.problemsMap = new Map(c.problems.map(p => [p.id, p]));
  }

  if (contestJSON.status_time_display !== undefined && contestJSON.status_time_display !== null) {
    c.statusTimeDisplay = {
      correct: Boolean(contestJSON.status_time_display.correct ?? false),
      incorrect: Boolean(contestJSON.status_time_display.incorrect ?? false),
      pending: Boolean(contestJSON.status_time_display.pending ?? false),
    };
  }

  c.badge = contestJSON.badge;
  c.medal = contestJSON.medal;

  (() => {
    if (contestJSON.medal === undefined || contestJSON.medal === null) {
      return;
    }

    c.awards = new Map<string, Award[]>();

    for (const k in contestJSON.medal) {
      const v = contestJSON.medal[k];

      {
        const award: Award[] = [];

        let rank = 1;
        const work = (key: string, medalType: MedalType) => {
          if (Object.keys(v).includes(key)) {
            const a = new Award();
            a.medalType = medalType;
            a.minRank = rank;
            rank += Number(v[key]);
            a.maxRank = rank - 1;
            award.push(a);
          }
        };

        work("gold", MedalType.GOLD);
        work("silver", MedalType.SILVER);
        work("bronze", MedalType.BRONZE);

        {
          const a = new Award();
          a.medalType = MedalType.HONORABLE;
          a.minRank = rank;
          a.maxRank = 0x3F3F3F3F;
          award.push(a);
        }

        c.awards.set(k, award);
      }
    }
  })();

  c.organization = contestJSON.organization;

  {
    const g = new Group();
    g.names.set("en", "All");
    g.names.set("zh-CN", "所有队伍");
    g.isDefault = true;

    c.group.set("all", g);
  }

  for (const [k, v] of Object.entries(contestJSON?.group ?? {})) {
    let key = k;

    const g = new Group();
    g.names.set("zh-CN", v);

    if (k === "official") {
      g.names.set("en", "Official");
    }

    if (k === "unofficial") {
      g.names.set("en", "Unofficial");
    }

    if (k === "girl" || k === "girls") {
      g.names.set("en", "Girls");
      key = "girl";
    }

    c.group.set(key, g);
  }

  c.banner = contestJSON.banner;

  c.logo = contestJSON.logo;
  c.boardLink = contestJSON.board_link;

  if (contestJSON.options) {
    c.options = createContestOptions(contestJSON.options);
  }

  return c;
}
export { ContestOptions };
