import gymScenes       from './gym.json'
import badTeamScenes   from './bad_team.json'
import finalBossScenes from './final_boss.json'
import randomScenes    from './random.json'
import type { SceneData } from '../../game/utils/sceneTypes'

export const ALL_SCENES: SceneData[] = [
  ...gymScenes       as unknown as SceneData[],
  ...badTeamScenes   as unknown as SceneData[],
  ...finalBossScenes as unknown as SceneData[],
  ...randomScenes    as unknown as SceneData[],
]

export { gymScenes, badTeamScenes, finalBossScenes, randomScenes }
