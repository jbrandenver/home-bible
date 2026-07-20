-- Home Automation demo fixture (optional, developer-run — NOT part of migrations
-- or the empty production seed). Populates one property's smart-home inventory
-- with a realistic 25-device home so the connection map, failure-impact, and
-- emergency views can be exercised.
--
-- Self-contained to automation_* tables (+ a few linked issues). It does NOT
-- create floors/rooms/utilities — it reuses the property's existing rooms.
-- Idempotent: re-running replaces the seed. Everything is tagged for cleanup:
--   devices  -> tags @> array['demo_seed']
--   hubs/networks/routines -> notes = 'demo_seed'
--   issues   -> title like '[Demo]%'
--   relationships -> description = 'demo_seed'
--
-- CLEANUP (removes everything this fixture created):
--   delete from public.automation_relationships where description='demo_seed';
--   delete from public.issues where title like '[Demo]%';
--   delete from public.automation_routines where notes='demo_seed';
--   delete from public.automation_devices where tags @> array['demo_seed'];
--   delete from public.automation_hubs where notes='demo_seed';
--   delete from public.automation_networks where notes='demo_seed';

begin;
create temp table _sp on commit drop as
  select id as pid from public.properties where deleted_at is null order by created_at desc limit 1;

-- idempotent reset
delete from public.automation_relationships where property_id=(select pid from _sp) and description='demo_seed';
delete from public.issues where property_id=(select pid from _sp) and title like '[Demo]%';
delete from public.automation_routines where property_id=(select pid from _sp) and notes='demo_seed';
delete from public.automation_devices where property_id=(select pid from _sp) and tags @> array['demo_seed'];
delete from public.automation_hubs where property_id=(select pid from _sp) and notes='demo_seed';
delete from public.automation_networks where property_id=(select pid from _sp) and notes='demo_seed';

-- NETWORKS (2 Wi-Fi + IoT VLAN + wired)
insert into public.automation_networks (property_id,name,network_type,ssid,internet_provider,is_iot,physical_location,recovery_instructions,notes) values
((select pid from _sp),'Home Wi-Fi','wifi','HomeNet','Comcast',false,'Office closet','Power-cycle the modem, then the router; wait 3 min.','demo_seed'),
((select pid from _sp),'IoT Wi-Fi','iot_vlan','HomeNet-IoT',null,true,'Office closet',null,'demo_seed'),
((select pid from _sp),'Wired LAN','ethernet',null,null,false,'Office closet',null,'demo_seed');

-- HUBS (Hue, Aqara, Thread border router, Home Assistant, voice assistant)
insert into public.automation_hubs (property_id,name,hub_type,network_id,local_control,cloud_dependency,internet_dependency,criticality,status,recovery_steps,notes) values
((select pid from _sp),'Hue Bridge','bridge',(select id from public.automation_networks where property_id=(select pid from _sp) and name='Home Wi-Fi'),true,false,false,'high','online','Unplug 30s and replug; the app rediscovers lights.','demo_seed'),
((select pid from _sp),'Aqara Hub','smart_home_hub',(select id from public.automation_networks where property_id=(select pid from _sp) and name='IoT Wi-Fi'),true,true,false,'high','online','Hold reset 10s; re-add sensors in the Aqara app.','demo_seed'),
((select pid from _sp),'Thread Border Router','thread_border_router',(select id from public.automation_networks where property_id=(select pid from _sp) and name='Home Wi-Fi'),true,false,false,'high','online','Reboot; Thread devices reattach automatically.','demo_seed'),
((select pid from _sp),'Home Assistant','local_automation_server',(select id from public.automation_networks where property_id=(select pid from _sp) and name='Wired LAN'),true,false,false,'critical','online','Reboot the mini-PC; open http://homeassistant.local:8123','demo_seed'),
((select pid from _sp),'Living Room Speaker','voice_assistant',(select id from public.automation_networks where property_id=(select pid from _sp) and name='Home Wi-Fi'),false,true,true,'normal','online',null,'demo_seed');

-- DEVICES (25)
insert into public.automation_devices (property_id,name,category,status,is_critical,power_type,primary_protocol,internet_required,local_control_available,battery_type,tags) values
((select pid from _sp),'Kitchen Ceiling Lights','lighting','online',false,'mains','zigbee',false,true,null,array['demo_seed']),
((select pid from _sp),'Living Room Lamp','lighting','online',false,'mains','zigbee',false,true,null,array['demo_seed']),
((select pid from _sp),'Hallway Light','lighting','online',false,'mains','zigbee',false,true,null,array['demo_seed']),
((select pid from _sp),'Front Door Lock','lock','online',true,'battery','zwave',false,true,'AA x4',array['demo_seed']),
((select pid from _sp),'Back Door Lock','lock','low_battery',true,'battery','zwave',false,true,'AA x4',array['demo_seed']),
((select pid from _sp),'Garage Door Controller','garage_door','online',true,'mains','wifi',false,true,null,array['demo_seed']),
((select pid from _sp),'Front Doorbell Camera','doorbell','online',true,'mains','wifi',true,false,null,array['demo_seed']),
((select pid from _sp),'Backyard Camera','camera','offline',false,'mains','wifi',true,false,null,array['demo_seed']),
((select pid from _sp),'Living Room Thermostat','thermostat','online',false,'mains','wifi',false,true,null,array['demo_seed']),
((select pid from _sp),'Nursery Leak Sensor','leak_detector','online',true,'battery','zigbee',false,true,'CR2032',array['demo_seed']),
((select pid from _sp),'Basement Leak Sensor','leak_detector','low_battery',true,'battery','zigbee',false,true,'CR2032',array['demo_seed']),
((select pid from _sp),'Main Water Shutoff Valve','water_shutoff_valve','online',true,'mains','zwave',false,true,null,array['demo_seed']),
((select pid from _sp),'Upstairs Smoke Detector','smoke_detector','online',true,'battery','thread',false,true,'CR123A',array['demo_seed']),
((select pid from _sp),'Downstairs CO Detector','carbon_monoxide_detector','online',true,'battery','thread',false,true,'CR123A',array['demo_seed']),
((select pid from _sp),'Bedroom Smart Shade','shades_blinds','online',false,'mains','zigbee',false,true,null,array['demo_seed']),
((select pid from _sp),'Office Smart Plug','outlet','online',false,'mains','wifi',false,true,null,array['demo_seed']),
((select pid from _sp),'Robot Vacuum','vacuum','offline',false,'battery','wifi',true,false,null,array['demo_seed']),
((select pid from _sp),'Air Quality Monitor','air_quality','online',false,'mains','wifi',false,true,null,array['demo_seed']),
((select pid from _sp),'Energy Monitor','energy_monitor','online',false,'hardwired','ethernet',false,true,null,array['demo_seed']),
((select pid from _sp),'EV Charger','ev_charger','online',false,'hardwired','wifi',false,true,null,array['demo_seed']),
((select pid from _sp),'Bathroom Fan','fan','online',false,'mains','zigbee',false,true,null,array['demo_seed']),
((select pid from _sp),'Irrigation Controller','irrigation','online',false,'mains','wifi',true,false,null,array['demo_seed']),
((select pid from _sp),'Bedroom Motion Sensor','sensor','low_battery',false,'battery','zigbee',false,true,'AAA x2',array['demo_seed']),
((select pid from _sp),'Upstairs Thermostat','thermostat','online',false,'mains','matter',false,true,null,array['demo_seed']),
((select pid from _sp),'Home Router','network_equipment','online',true,'mains','ethernet',false,true,null,array['demo_seed']);

-- link devices to hubs
update public.automation_devices set primary_hub_id=(select id from public.automation_hubs where property_id=(select pid from _sp) and name='Hue Bridge')
  where property_id=(select pid from _sp) and name in ('Kitchen Ceiling Lights','Living Room Lamp','Hallway Light','Bedroom Smart Shade','Bathroom Fan');
update public.automation_devices set primary_hub_id=(select id from public.automation_hubs where property_id=(select pid from _sp) and name='Aqara Hub')
  where property_id=(select pid from _sp) and name in ('Front Door Lock','Back Door Lock','Nursery Leak Sensor','Basement Leak Sensor','Main Water Shutoff Valve','Bedroom Motion Sensor');
update public.automation_devices set primary_hub_id=(select id from public.automation_hubs where property_id=(select pid from _sp) and name='Thread Border Router')
  where property_id=(select pid from _sp) and name in ('Upstairs Smoke Detector','Downstairs CO Detector','Upstairs Thermostat');

-- link devices to networks
update public.automation_devices set primary_network_id=(select id from public.automation_networks where property_id=(select pid from _sp) and name='IoT Wi-Fi')
  where property_id=(select pid from _sp) and name in ('Front Doorbell Camera','Backyard Camera','Robot Vacuum','Irrigation Controller');
update public.automation_devices set primary_network_id=(select id from public.automation_networks where property_id=(select pid from _sp) and name='Wired LAN')
  where property_id=(select pid from _sp) and name in ('Energy Monitor','Home Router');
update public.automation_devices set primary_network_id=(select id from public.automation_networks where property_id=(select pid from _sp) and name='Home Wi-Fi')
  where property_id=(select pid from _sp) and tags @> array['demo_seed'] and primary_network_id is null and primary_hub_id is null;

-- spread devices across existing rooms (reuses the property's real rooms)
update public.automation_devices d
set room_id = r.id
from (select id, (row_number() over (order by created_at) - 1) as rn
      from public.rooms where property_id=(select pid from _sp) and deleted_at is null limit 8) r
where d.property_id=(select pid from _sp) and d.tags @> array['demo_seed']
  and (abs(hashtext(d.name)) % greatest((select count(*) from public.rooms where property_id=(select pid from _sp) and deleted_at is null limit 8),1)) = r.rn;

-- protocols (derived) — 6 distinct across the fleet
insert into public.automation_device_protocols (property_id, device_id, protocol, is_primary)
select property_id, id, primary_protocol, true from public.automation_devices
where property_id=(select pid from _sp) and tags @> array['demo_seed'] and primary_protocol is not null;

-- ecosystems (4)
insert into public.automation_device_ecosystems (property_id, device_id, ecosystem)
select property_id, id, 'apple_home' from public.automation_devices where property_id=(select pid from _sp) and name in ('Front Door Lock','Upstairs Smoke Detector','Downstairs CO Detector','Upstairs Thermostat');
insert into public.automation_device_ecosystems (property_id, device_id, ecosystem)
select property_id, id, 'google_home' from public.automation_devices where property_id=(select pid from _sp) and name in ('Kitchen Ceiling Lights','Living Room Lamp','Living Room Thermostat');
insert into public.automation_device_ecosystems (property_id, device_id, ecosystem)
select property_id, id, 'ring' from public.automation_devices where property_id=(select pid from _sp) and name in ('Front Doorbell Camera','Backyard Camera');
insert into public.automation_device_ecosystems (property_id, device_id, ecosystem)
select property_id, id, 'home_assistant' from public.automation_devices where property_id=(select pid from _sp) and name in ('Office Smart Plug','Energy Monitor','EV Charger','Home Router');

-- AUTOMATIONS (10)
insert into public.automation_routines (property_id,name,routine_type,status,criticality,trigger_text,actions_text,manual_override,failure_behavior,internet_dependency,local_control_available,notes) values
((select pid from _sp),'Shut off water on leak','safety','active','critical','Any leak sensor detects water','Close the main water valve and alert phones','Close the manual valve under the kitchen sink','Valve stays open; rely on the manual shut-off',false,true,'demo_seed'),
((select pid from _sp),'Lock up at night','security','active','high','10:30 PM','Lock all doors, arm the alarm','Use the keypad or physical key',null,false,true,'demo_seed'),
((select pid from _sp),'Away mode','presence','active','high','Everyone leaves','Lock doors, cameras on, thermostat to eco',null,null,false,true,'demo_seed'),
((select pid from _sp),'Exterior lights at sunset','lighting','active','normal','Sunset','Turn on exterior lights',null,null,false,true,'demo_seed'),
((select pid from _sp),'Good morning','scene','active','normal','7:00 AM weekdays','Raise shades, kitchen lights on',null,null,false,true,'demo_seed'),
((select pid from _sp),'Movie night','scene','active','low','Wall switch','Dim living room, lower shades',null,null,false,true,'demo_seed'),
((select pid from _sp),'Smoke response','safety','active','critical','Smoke detected','HVAC off, unlock doors, all lights on',null,null,false,true,'demo_seed'),
((select pid from _sp),'Vacation lighting','presence','untested','normal','While away','Randomize lights in the evening',null,null,false,true,'demo_seed'),
((select pid from _sp),'Freezer power-loss alert','energy','broken','high','Freezer plug loses power','Push a phone alert',null,'No alert is sent — depends on the cloud service, currently down',true,false,'demo_seed'),
((select pid from _sp),'Cool down on heat','climate','active','normal','Indoor temp above 78°F','Lower shades, turn on AC',null,null,false,true,'demo_seed');

-- automation ↔ device roles
insert into public.automation_routine_devices (property_id, routine_id, device_id, role)
select (select pid from _sp), r.id, d.id, 'trigger'
from public.automation_routines r, public.automation_devices d
where r.property_id=(select pid from _sp) and r.name='Shut off water on leak'
  and d.property_id=(select pid from _sp) and d.name in ('Nursery Leak Sensor','Basement Leak Sensor');
insert into public.automation_routine_devices (property_id, routine_id, device_id, role)
select (select pid from _sp), r.id, d.id, 'action'
from public.automation_routines r, public.automation_devices d
where r.property_id=(select pid from _sp) and r.name='Shut off water on leak'
  and d.property_id=(select pid from _sp) and d.name='Main Water Shutoff Valve';
insert into public.automation_routine_devices (property_id, routine_id, device_id, role)
select (select pid from _sp), r.id, d.id, 'trigger'
from public.automation_routines r, public.automation_devices d
where r.property_id=(select pid from _sp) and r.name='Smoke response'
  and d.property_id=(select pid from _sp) and d.name in ('Upstairs Smoke Detector','Downstairs CO Detector');
insert into public.automation_routine_devices (property_id, routine_id, device_id, role)
select (select pid from _sp), r.id, d.id, 'action'
from public.automation_routines r, public.automation_devices d
where r.property_id=(select pid from _sp) and r.name in ('Lock up at night','Away mode')
  and d.property_id=(select pid from _sp) and d.name in ('Front Door Lock','Back Door Lock');

-- ISSUES (3) linked to devices
insert into public.issues (property_id, automation_device_id, title, issue_type, status, severity)
select (select pid from _sp), id, '[Demo] Backyard camera keeps disconnecting','smart_home','open','high' from public.automation_devices where property_id=(select pid from _sp) and name='Backyard Camera';
insert into public.issues (property_id, automation_device_id, title, issue_type, status, severity)
select (select pid from _sp), id, '[Demo] Back door lock battery drains fast','smart_home','open','medium' from public.automation_devices where property_id=(select pid from _sp) and name='Back Door Lock';
insert into public.issues (property_id, automation_device_id, title, issue_type, status, severity)
select (select pid from _sp), id, '[Demo] Robot vacuum offline after network change','smart_home','monitoring','low' from public.automation_devices where property_id=(select pid from _sp) and name='Robot Vacuum';

-- CLOUD dependencies (for failure-impact cloud picker)
insert into public.automation_relationships (property_id, source_type, source_id, target_type, target_label, relationship_type, description)
select (select pid from _sp), 'device', id, 'cloud_service', 'Ring Cloud', 'depends_on', 'demo_seed'
from public.automation_devices where property_id=(select pid from _sp) and name in ('Front Doorbell Camera','Backyard Camera');
insert into public.automation_relationships (property_id, source_type, source_id, target_type, target_label, relationship_type, description)
select (select pid from _sp), 'device', id, 'cloud_service', 'Rachio Cloud', 'depends_on', 'demo_seed'
from public.automation_devices where property_id=(select pid from _sp) and name='Irrigation Controller';

commit;
