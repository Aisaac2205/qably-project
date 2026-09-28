import {
  scaleBand as d3ScaleBand,
  scaleLinear as d3ScaleLinear,
  scaleTime as d3ScaleTime,
} from "d3-scale";
import type {
  ScaleBand,
  ScaleLinear as D3ScaleLinear,
  ScaleTime as D3ScaleTime,
} from "d3-scale";

interface ContinuousConfig<Output> {
  domain?: Iterable<number>;
  range?: Iterable<Output>;
  clamp?: boolean;
  nice?: boolean | number;
}

interface TimeConfig<Output> {
  domain?: Iterable<Date | number>;
  range?: Iterable<Output>;
  clamp?: boolean;
  nice?: boolean | number;
}

interface BandConfig<Domain extends { toString(): string }, Output = number> {
  domain?: Iterable<Domain>;
  range?: Iterable<Output>;
  padding?: number;
  paddingInner?: number;
  paddingOuter?: number;
  align?: number;
  round?: boolean;
}

function applyNice(
  scale: { nice(count?: number): unknown },
  nice: boolean | number | undefined
) {
  if (nice === true) {
    scale.nice();
    return;
  }
  if (typeof nice === "number") {
    scale.nice(nice);
  }
}

export function scaleLinear<Output = number>(
  config: ContinuousConfig<Output> = {}
): D3ScaleLinear<Output, Output> {
  const scale = d3ScaleLinear<Output, Output>();
  if (config.domain) {
    scale.domain([...config.domain]);
  }
  if (config.range) {
    scale.range([...config.range]);
  }
  if (config.clamp != null) {
    scale.clamp(config.clamp);
  }
  applyNice(scale, config.nice);
  return scale;
}

export function scaleTime<Output = number>(
  config: TimeConfig<Output> = {}
): D3ScaleTime<Output, Output> {
  const scale = d3ScaleTime<Output, Output>();
  if (config.domain) {
    scale.domain([...config.domain]);
  }
  if (config.range) {
    scale.range([...config.range]);
  }
  if (config.clamp != null) {
    scale.clamp(config.clamp);
  }
  applyNice(scale, config.nice);
  return scale;
}

export function scaleBand<Domain extends { toString(): string } = string>(
  config: BandConfig<Domain> = {}
): ScaleBand<Domain> {
  const scale = d3ScaleBand<Domain>();
  if (config.domain) {
    scale.domain([...config.domain]);
  }
  if (config.range) {
    scale.range([...config.range] as [number, number]);
  }
  if (config.padding != null) {
    scale.padding(config.padding);
  }
  if (config.paddingInner != null) {
    scale.paddingInner(config.paddingInner);
  }
  if (config.paddingOuter != null) {
    scale.paddingOuter(config.paddingOuter);
  }
  if (config.align != null) {
    scale.align(config.align);
  }
  if (config.round != null) {
    scale.round(config.round);
  }
  return scale;
}
