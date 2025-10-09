import { ChatBasicNode } from './nodes/chat.basic';
import { IntentPlanNode } from './nodes/intent.plan';
import { ResultNarrateNode } from './nodes/result.narrate';
import { RulesExtractNode } from './nodes/rules.extract';
import { RulesNarrateNode } from './nodes/rules.narrate';
import { SceneBriefNode } from './nodes/scene.brief';
import { SceneDetailNode } from './nodes/scene.detail';
import { TurnSummarizeNode } from './nodes/turn.summarize';
import { SessionSummarizeNode } from './nodes/session.summarize';
import { NpcReplyNode } from './nodes/npc.reply';
import { NpcNameNode } from './nodes/npc.name';
import { EntityLinkNode } from './nodes/entity.link';
import { IntentDisambiguateNode } from './nodes/intent.disambiguate';
import { TurnSuggestNode } from './nodes/turn.suggest';
import { SceneHazardTagNode } from './nodes/scene.hazard.tag';
import { SafetyScreenNode } from './nodes/safety.screen';
const NODE_MAP = new Map([
    [ChatBasicNode.id, ChatBasicNode],
    [IntentPlanNode.id, IntentPlanNode],
    [ResultNarrateNode.id, ResultNarrateNode],
    [RulesExtractNode.id, RulesExtractNode],
    [RulesNarrateNode.id, RulesNarrateNode],
    [SceneBriefNode.id, SceneBriefNode],
    [SceneDetailNode.id, SceneDetailNode],
    [TurnSummarizeNode.id, TurnSummarizeNode],
    [SessionSummarizeNode.id, SessionSummarizeNode],
    [NpcReplyNode.id, NpcReplyNode],
    [NpcNameNode.id, NpcNameNode],
    [EntityLinkNode.id, EntityLinkNode],
    [IntentDisambiguateNode.id, IntentDisambiguateNode],
    [TurnSuggestNode.id, TurnSuggestNode],
    [SceneHazardTagNode.id, SceneHazardTagNode],
    [SafetyScreenNode.id, SafetyScreenNode]
]);
export const InMemoryNodeRegistry = {
    get(nodeId) {
        return NODE_MAP.get(nodeId) ?? null;
    }
};
