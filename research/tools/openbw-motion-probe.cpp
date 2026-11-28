// Research fixture only; build against the pinned OpenBW source. See BC-V6-ENGINE-MOTION.md.
#include <iostream>
#include <string>
#include "bwgame.h"
using namespace bwgame;
int main(int argc,char** argv) {
  if(argc!=3) return 2;
  game_player p;
  data_loading::data_files_loader<> files;
  for(auto f: {"patch_rt.mpq","BrooDat.mpq","StarDat.mpq"}) files.add_mpq_file(a_string("StarEdit/")+f);
  p.init(files);
  p.load_map_file("motion-lab.scx");
  auto& f=p.funcs();
  const auto id=UnitTypes(std::stoi(argv[1]));
  auto* u=f.trigger_create_unit(f.get_unit_type(id),{600,704},0);
  if(!u) return 3;
  const std::string mode=argv[2];
  const bool attack=mode=="attack";
  unit_t* target=nullptr;
  if(attack) {
    auto tt=id==UnitTypes::Zerg_Scourge?UnitTypes::Terran_Science_Vessel:UnitTypes::Terran_Medic;
    target=f.create_unit(tt,{1104,704},1);
    if(!target){std::cerr<<"create failed\n";return 4;}
    f.finish_building_unit(target);
    if(!f.place_completed_unit(target)){std::cerr<<"place failed "<<f.is_walkable({1104,704})<<"\n";return 4;}
    f.complete_unit(target);
    if(!target) return 4;
  }
  for(int i=0;i<12;i++) p.next_frame();
  f.set_unit_heading(u,direction_t::from_raw(64));
  if(attack) f.set_unit_order(u,f.get_order_type(Orders::AttackUnit),target);
  else f.set_unit_order(u,f.get_order_type(Orders::Move),xy(mode=="arrival"?1000:1300,704));
  std::cout<<"frame,x_raw,y_raw,speed_raw,next_speed_raw,heading_raw,veldir_raw,order,move_x,move_y,flags,weapon_lock,own_bullets,target_hp_raw,target_shield_raw\n";
  for(int i=0;i<=340;i++){
    if(i==50&&mode=="stop") f.set_unit_order(u,f.get_order_type(Orders::Stop));
    if(i==50&&mode=="turn90") f.set_unit_order(u,f.get_order_type(Orders::Move),xy(u->position.x,1300));
    if(i==50&&mode=="turn180") f.set_unit_order(u,f.get_order_type(Orders::Move),xy(350,704));
    int shots=0;
    for(const auto& bullet:p.st().active_bullets) if(bullet.bullet_owner_unit==u) ++shots;
    std::cout<<i<<','<<u->exact_position.x.raw_value<<','<<u->exact_position.y.raw_value<<','<<u->current_speed.raw_value<<','<<u->next_speed.raw_value<<','<<int(u->heading.raw_value)<<','<<int(u->current_velocity_direction.raw_value)<<','<<int(u->order_type->id)<<','<<u->move_target.pos.x<<','<<u->move_target.pos.y<<','<<int(u->movement_flags)<<','<<int(bool(u->movement_flags&8))<<','<<shots<<','<<(target?target->hp.raw_value:0)<<','<<(target?target->shield_points.raw_value:0)<<'\n';
    if(attack&&(u->hp.raw_value<=0||(target&&(target->hp.raw_value<=0)))) break;
    p.next_frame();
  }
}
