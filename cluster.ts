/**
 * Cluster and file transfer API.
 *
 * @module cluster
 */

import { Encoder, MsgValue } from "./msgpack";
import {
  abiCall, checkError, emptyReq,
  _file_transfer_send, _file_transfer_recv, _cluster_node_list,
} from "./abi_internal";

/**
 * Send a file to a remote cluster node via relay. Requires cluster mode.
 * @param targetNode - Destination node ID.
 * @param localPath - Local file path.
 * @param remotePath - Path on target node.
 */
export function fileTransferSend(targetNode: string, localPath: string, remotePath: string): void {
  const enc = new Encoder(); enc.encode_map_header(3);
  enc.encode_str("target_node"); enc.encode_str(targetNode);
  enc.encode_str("local_path"); enc.encode_str(localPath);
  enc.encode_str("remote_path"); enc.encode_str(remotePath);
  checkError(abiCall(_file_transfer_send, enc.finish()), "file_transfer_send");
}

/**
 * Request a file from a remote cluster node (pull mode). Requires cluster mode.
 * @param sourceNode - Source node ID.
 * @param remotePath - Path on source node.
 * @param localPath - Local destination path.
 */
export function fileTransferRecv(sourceNode: string, remotePath: string, localPath: string): void {
  const enc = new Encoder(); enc.encode_map_header(3);
  enc.encode_str("source_node"); enc.encode_str(sourceNode);
  enc.encode_str("remote_path"); enc.encode_str(remotePath);
  enc.encode_str("local_path"); enc.encode_str(localPath);
  checkError(abiCall(_file_transfer_recv, enc.finish()), "file_transfer_recv");
}

/** Cluster node information. */
export class ClusterNodeInfo {
  node_id: string = "";
  role: string = "";
  skills: string[] = [];
}

/** Result from {@link clusterNodeList}. */
export class ClusterNodeListResult {
  current_node: string = "";
  nodes: ClusterNodeInfo[] = [];
}

/**
 * List known cluster nodes. Requires cluster mode.
 * @returns Current node ID and list of all nodes.
 */
export function clusterNodeList(): ClusterNodeListResult {
  const resp = abiCall(_cluster_node_list, emptyReq()); checkError(resp, "cluster_node_list");
  const r = new ClusterNodeListResult();
  r.current_node = resp.getField("current_node").getStr();
  const rawNodes = resp.getField("nodes");
  const n = rawNodes.getArrayLen();
  for (let i = 0; i < n; i++) {
    const item = rawNodes.getIndex(i);
    const node = new ClusterNodeInfo();
    node.node_id = item.getField("node_id").getStr();
    node.role = item.getField("role").getStr();
    const rawSkills = item.getField("skills");
    const sn = rawSkills.getArrayLen();
    for (let j = 0; j < sn; j++) {
      node.skills.push(rawSkills.getIndex(j).getStr());
    }
    r.nodes.push(node);
  }
  return r;
}
