
import test from "node:test";
import assert from "node:assert/strict";
import { compareHistory, historyDto } from "./history.ts";
import { historyCommand, historyPhoto, historyQuery } from "./history-http.ts";

const id = number => "00000000-0000-4000-8000-" + String(number).padStart(12,"0");
const result = () => ({
  schema_version: "dentaia.premium-vision-result.v1",
  provider: { id:"rf-detr-premium", availability:"available" },
  model: { identifier:"fixture", version:"v1", architecture:"RF-DETR Small", weights_format:"pytorch", input_width:512, input_height:512 },
  evaluation: { status:"evaluated_no_detections", reference_image:{width:512,height:512},
    image_quality:{status:"adequate",issues:[]}, detections:[], limitations:[], error_code:null },
});
const item = index => ({
  id:id(index),date:"2026-11-24T18:00:00.000001Z",result:result(),captureProtocol:"frontal_intraoral_v1",photo:false,shareable:false,shares:[],
});
const detection = (coco, index) => ({
  category:{original_label:"calculus",label_es:"Cálculo dental",coco_category_id:coco,inference_class_index:index},
  confidence:.8,bounding_box:{format:"xyxy",coordinate_space:"reference_image_pixels",origin:"top_left",x_min:0,y_min:0,x_max:10,y_max:12},
});

test("compara recuentos por categoría sin usar puntuaciones de confianza", () => {
  const a = item(1), b = item(2);
  a.result.evaluation.status="evaluated";
  a.result.evaluation.detections=[detection(8,0),detection(8,0)];
  assert.deepEqual(compareHistory(a,b).rows[0],{label:"Cálculo dental",counts:[2,0]});
});

test("rechaza modelos, taxonomías, protocolos, dimensiones y calidad incompatibles", () => {
  for (const alter of [
    x => x.result.model.version="v2",
    x => x.captureProtocol=null,
    x => x.result.evaluation.reference_image.width=640,
    x => x.result.evaluation.image_quality.issues.push("fixture"),
    x => x.result.evaluation.image_quality.status="review",
  ]) {
    const b = item(2);
    alter(b);
    assert.ok(compareHistory(item(1),b).reason);
  }
  const a = item(1), b = item(2);
  for (const row of [a,b]) row.result.evaluation.status="evaluated";
  a.result.evaluation.detections=[detection(1,0)];
  b.result.evaluation.detections=[detection(2,0)];
  assert.match(compareHistory(a,b).reason,/taxonomía/);
});

test("un estado parcial, no evaluable o fallido conserva su semántica y no se compara", () => {
  for (const status of ["partially_evaluated","provider_unavailable","not_evaluable","processing_error"]) {
    const b = item(2);
    b.result.evaluation.status=status;
    b.result.evaluation.limitations.push("Fixture");
    b.result.evaluation.image_quality.status=status==="partially_evaluated"?"review":"not_evaluated";
    if (status==="processing_error" || status==="provider_unavailable") b.result.evaluation.error_code="FIXTURE";
    if (status==="provider_unavailable") {
      b.result.model.version=null;
      b.result.provider.availability="unavailable";
    }
    assert.equal(historyDto({items:[b],premium:true,consents:{}}).items[0].result.evaluation.status,status);
    assert.ok(compareHistory(item(1),b).reason);
  }
});

test("la proyección valida el contrato, limita la página y descarta atributos no previstos", () => {
  const items=Array.from({length:21},(_,i)=>({...item(i),objectPath:"must-not-leak",actor:"must-not-leak"}));
  const response=historyDto({items,premium:false,consents:{},secret:"must-not-leak"});
  assert.equal(response.items.length,20);
  assert.deepEqual(response.next,{id:id(19),before:items[0].date});
  assert.doesNotMatch(JSON.stringify(response),/must-not-leak/);
  items[0].result.evaluation.error_code="INVALID";
  assert.throws(()=>historyDto({items,premium:true,consents:{}}));
});

test("la consulta rechaza identidad del paciente, parámetros URL y cursores incompletos", async () => {
  const read = (body,professional=false,query="") => historyQuery(new Request("http://localhost/path"+query, {
    method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify(body),
  }),professional);
  for (const body of [{patientId:id(1)},{photo:id(2),afterId:id(3)},{afterId:id(3)}]) {
    await assert.rejects(read(body),{status:400});
  }
  await assert.rejects(read({},false,"?photo="+id(2)),{status:400});
  await assert.rejects(read({membershipId:id(4)},true),{status:400});
  assert.equal((await read({patientId:id(1),membershipId:id(4),photo:id(2)},true)).evaluation,id(2));
});

test("la ruta de gestión rechaza resultados, actor y aceptación implícita", async () => {
  const command = body => historyCommand(new Request("http://localhost/path",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify(body)}));
  await assert.rejects(command({action:"save",evaluationId:id(1),result:result()}), {status:400});
  await assert.rejects(command({action:"delete",evaluationId:id(1),patientId:id(2)}), {status:400});
  await assert.rejects(command({action:"consent_accept",purpose:"premium_history_results",version:"di214.v1"}), {status:400});
  await assert.rejects(command({action:"share",evaluationId:id(1),grantId:id(2),photo:true}), {status:400});
  assert.equal((await command({action:"share",evaluationId:id(1),grantId:id(2),photo:true,accepted:true})).grant,id(2));
});

const validPhoto = {
  path:id(1)+"/"+id(2)+"/original.png", mime:"image/png", size:80, digest:"ab".repeat(32),
};

test("historyPhoto rechaza segmentos de recorrido literales, codificados y con separadores", () => {
  for (const suffix of [".","..","../original.png","%2e%2e","..\\original.png"]) {
    const path = id(1)+"/"+id(2)+"/"+suffix;
    assert.throws(() => historyPhoto({...validPhoto,path}), {message:"INVALID_PREMIUM_PHOTO"});
  }
});

test("historyPhoto rechaza un MIME ajeno a los formatos permitidos", () => {
  assert.throws(() => historyPhoto({...validPhoto,mime:"image/svg+xml"}), {message:"INVALID_PREMIUM_PHOTO"});
});

test("historyPhoto rechaza un digest con longitud o caracteres incorrectos", () => {
  for (const digest of ["a".repeat(63),"g".repeat(64)]) {
    assert.throws(() => historyPhoto({...validPhoto,digest}), {message:"INVALID_PREMIUM_PHOTO"});
  }
});

test("historyPhoto acepta y proyecta una referencia válida", () => {
  assert.deepEqual(historyPhoto({...validPhoto,extra:"omitido"}),validPhoto);
});
