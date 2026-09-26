import {GameError} from './engine.mjs';
/** Prepared SQL shared by the local SQLite adapter and Cloudflare D1. */
export class Store{
 constructor(db){this.db=db;}
 async health(){return !!(await this.db.prepare('SELECT 1 AS ok').first())?.ok;}
 async cleanup(now){await this.db.prepare('DELETE FROM rooms WHERE expires_at<=?').bind(now).run();await this.db.prepare('DELETE FROM rate_limits WHERE expires_at<=?').bind(now).run();}
 async create(r){const q=await this.db.prepare('INSERT OR IGNORE INTO rooms(code,version,payload,status,scenario,team_name,score,listed,report_id,created_at,expires_at,finished_at) VALUES (?,0,?,?,?,?,?,?,?,?,?,NULL)').bind(r.code,JSON.stringify(r),r.status,r.scenarioId,r.players[0].name,r.score,r.listed?1:0,r.reportId,r.createdAt,r.expiresAt).run();return q.meta.changes===1;}
 async get(code,now){const row=await this.db.prepare('SELECT payload,version FROM rooms WHERE code=? AND expires_at>?').bind(code,now).first();return row?{...JSON.parse(row.payload),version:row.version}:null;}
 async byReport(id,now){const row=await this.db.prepare('SELECT payload,version FROM rooms WHERE report_id=? AND expires_at>?').bind(id,now).first();return row?{...JSON.parse(row.payload),version:row.version}:null;}
 async save(r,v){r.version=v+1;const q=await this.db.prepare('UPDATE rooms SET version=?,payload=?,status=?,score=?,finished_at=? WHERE code=? AND version=?').bind(r.version,JSON.stringify(r),r.status,r.score,r.finishedAt,r.code,v).run();return q.meta.changes===1;}
 async mutate(code,now,fn){for(let i=0;i<8;i++){const r=await this.get(code,now);if(!r)throw new GameError('No encontramos esa sala, o venció su plazo de 7 días.',404);const v=r.version;await fn(r);if(await this.save(r,v))return r;}throw new GameError('Hubo acciones simultáneas. Reintentá.',409);}
 async limit(key,max,window,now){const bucket=Math.floor(now/window);const q=await this.db.prepare('INSERT INTO rate_limits(key,hits,expires_at) VALUES (?,1,?) ON CONFLICT(key) DO UPDATE SET hits=hits+1 WHERE hits<?').bind(`${key}:${bucket}`,(bucket+1)*window,max).run();if(q.meta.changes!==1)throw new GameError('Demasiadas solicitudes. Esperá un momento y reintentá.',429);}
 async capacity(now){if((await this.db.prepare('SELECT COUNT(*) AS n FROM rooms WHERE expires_at>?').bind(now).first()).n>=5000)throw new GameError('El servidor alcanzó su capacidad de salas.',503);}
 async leaderboard(now){return(await this.db.prepare("SELECT team_name AS name,score,scenario,report_id AS reportId,finished_at AS finishedAt FROM rooms WHERE listed=1 AND status='resolved' AND expires_at>? ORDER BY score DESC,finished_at ASC LIMIT 20").bind(now).all()).results;}
 async remove(code){await this.db.prepare('DELETE FROM rooms WHERE code=?').bind(code).run();}
}
