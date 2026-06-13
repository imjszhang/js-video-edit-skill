export interface Word {
  word: string;
  start: number;
  end: number;
}

export interface Segment {
  id: number;
  start: number;
  end: number;
  text: string;
  words: Word[];
}

export interface Transcript {
  file: string;
  segments: Segment[];
}

export interface SceneCandidate {
  file: string;
  reason_rejected?: string;
  reason_selected?: string;
}

export interface Scene {
  scene_id: number;
  scene_name: string;
  candidates: SceneCandidate[];
  selected: string;
  in_point: number;
  out_point: number;
  reason: string;
}

export interface GlobalSettings {
  target_duration?: string;
  color_profile?: string;
  subtitle_style?: string;
}

export interface EditingDecision {
  scenes: Scene[];
  global_settings: GlobalSettings;
}
