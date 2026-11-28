from pathlib import Path
import re,struct
base=Path('battle_craft/research/local-source/cloud-intake-20261128')
enum=(base/'engine-data/openbw-src/bwenums.h').read_text()
e={}
for tag in ('UnitTypes','WeaponTypes','UpgradeTypes'):
 block=enum.split(' '+tag+' ')[1].split('{',1)[1].split('};',1)[0]
 words=block.split(',')
 n=0
 for w in words:
  m=re.match(r'(\w+)(?:\s*=\s*(\d+))?',w.strip())
  if not m:continue
  if m[2]:n=int(m[2])
  e[m[1]]=n;n+=1
print({k:e.get(k) for k in ['Acid_Spore','Acid_Spore_Kukulza','Halo_Rockets','Scarab','Scarab_Damage','Reaver_Capacity','Zerg_Guardian','Hero_Warbringer','Terran_Valkyrie','Protoss_Reaver','Protoss_Scarab']})
U=[44,56,58,81,83,85]; W=[e[k] for k in ('Halo_Rockets','Acid_Spore','Acid_Spore_Kukulza','Scarab')]
src=(base/'engine-data/openbw-src/data_loading.h').read_text()
types={'uint8_t':'B','int8_t':'b','uint16_t':'H','int16_t':'h','uint32_t':'I','int32_t':'i'}
def dat(table,counts,ids,fields):
 block=src.split(f'load_{table}_dat(')[-1].split('if (r.left())')[0]
 b=(base/f'engine-data/tables/{table}.dat').read_bytes(); off=0
 data={i:{} for i in ids}
 for t,field,count,skip in re.findall(r'rawr(?:o)?\((\w+), (\w+), (\w+)(?:, (\w+))?\);',block):
  typ=types[t]
  width=4 if field=='dimensions' else 2 if field in ['placement_size','addon_position'] else 1
  for id in ids:
   if field in fields:
    vals=struct.unpack_from('<'+typ*width,b,off+(id-counts.get(skip,0))*struct.calcsize(typ)*width)
    data[id][field]=vals[0] if len(vals)==1 else vals
  off+=struct.calcsize(typ)*counts[count]*width
 return data
print('units.dat',dat('units',dict(total_count=228,units_count=106,buildings_count=96),U,('hitpoints','has_shield','shield_points','armor','dimensions','flingy','unit_size','ground_weapon','air_weapon','target_acquisition_range','build_time','mineral_cost')))
wp=dat('weapons',dict(count=130),W,('target_flags','min_range','max_range','damage_type','bullet_type','lifetime','hit_type','damage_amount','damage_bonus','cooldown','bullet_count','attack_angle','bullet_heading_offset','forward_offset','upward_offset','inner_splash_radius','medium_splash_radius','outer_splash_radius','flingy','damage_upgrade'))
print('weapons.dat',wp)
print('flingy.dat',dat('flingy',dict(count=209),[5,18,26,85,122,128,*map(lambda d:d['flingy'],wp.values())],('top_speed','acceleration','halt_distance','turn_rate','movement_type')))
for f in (base/'evidence').rglob('scenario.chk'):
 d=f.read_bytes();i=0;s={}
 while i+8<=len(d):
  tag,n=struct.unpack_from('<4si',d,i)
  if n<0 or i+8+n>len(d):break
  s[tag]=d[i+8:i+8+n];i+=8+n
 print('\n===',f.parts[-3])
 st=s[b'STR ']; count=struct.unpack_from('<H',st,0)[0]
 def name(idx):
  if not idx or idx>count:return str(idx)
  off=struct.unpack_from('<H',st,2*idx)[0]; end=st.find(b'\0',off)
  return re.sub(r'[\x00-\x1f]','',st[off:end].decode('utf8','replace')).strip()
 d=s[b'UNIx']; uu=lambda i:struct.unpack_from('<H',d,i)[0]
 for i in U:print('unit',i,d[i],struct.unpack_from('<I',d,228+4*i)[0]/256,uu(1140+2*i),d[1596+i],name(uu(3192+2*i)))
 for i in W:print('weapon',i,uu(3648+2*i),uu(3908+2*i))
 d=s[b'PUPx'];n=61
 for i in [e['Scarab_Damage'],e['Reaver_Capacity']]:
  print('upgrade',i,'global max/current',d[24*n+i],d[25*n+i], 'P1–P4',[(d[p*n+i],d[(12+p)*n+i],d[(26+p)*n+i]) for p in range(4)])
 d=s[b'UPRP']; rp=lambda i: struct.unpack_from('<HHBBBBIHHI',d,(i-1)*20)
 d=s[b'TRIG']; 
 for off in range(0,len(d),2400):
  c=[struct.unpack_from('<IIIHBBBBH',d,off+i*20) for i in range(16)]
  a=[struct.unpack_from('<IIIIIIHBBBBH',d,off+320+i*32) for i in range(64)]
  if any((v[7] in (11,44) and v[6] in (44,56,58,81,83,85)) or v[7]==53 for v in a):
   own=list(d[off+2372:off+2400]); own=[i for i,x in enumerate(own) if x]
   print('trigger',off//2400+1,'owner',own,'cond',[x for x in c if x[5]], 'act',[(i+1,v, name(v[1]) if v[7]==47 else rp(v[5]) if v[7]==11 else None) for i,v in enumerate(a) if v[7]])
 d=s[b'UNIT']
 print('preplaced',[struct.unpack_from('<IHHHHHHBBBBIHHII',d,i) for i in range(0,len(d),36) if struct.unpack_from('<H',d,i+8)[0] in (81,83,85)])
