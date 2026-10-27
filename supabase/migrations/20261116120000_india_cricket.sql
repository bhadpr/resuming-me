-- India cricket 2026-27. Sheet times are Pacific. A phone shifts them to its own clock.
-- More teams can be inserted the same way when their files arrive.

insert into public.shared_lists (id, title, status, remind_before, zip_codes, search_keys, time_zone)
values
  ('fbc7503e-d3df-59fa-9f7c-df091344d18e', 'India', 'active', false, '{}', '{india,"team india",ind,"men in blue","indian cricket team",bharat}', 'America/Los_Angeles')
on conflict (id) do nothing;

insert into public.shared_list_items (id, list_id, text, day, hour, minute, sort_order)
values
  ('0090241d-3f5d-5e49-a94c-36e50e25287d', 'fbc7503e-d3df-59fa-9f7c-df091344d18e', 'India at New Zealand · T20I (4th of 5)', '2026-10-30', 0, 0, 0),
  ('d41f628f-10c4-5530-adb9-3171465e8dd6', 'fbc7503e-d3df-59fa-9f7c-df091344d18e', 'India at New Zealand · T20I (5th of 5)', '2026-11-01', 0, 0, 1),
  ('6e39713e-7584-5f38-816f-1298e280aa9f', 'fbc7503e-d3df-59fa-9f7c-df091344d18e', 'India at New Zealand · ODI (1st of 5)', '2026-11-03', 18, 0, 2),
  ('5fce8442-b9a7-51ed-a5f0-637a25dbae6b', 'fbc7503e-d3df-59fa-9f7c-df091344d18e', 'India at New Zealand · ODI (2nd of 5)', '2026-11-06', 18, 0, 3),
  ('2eac9a53-22f6-56b8-acce-2ca4747ad34f', 'fbc7503e-d3df-59fa-9f7c-df091344d18e', 'India at New Zealand · ODI (3rd of 5)', '2026-11-09', 18, 0, 4),
  ('6e756b97-76af-5e49-a68a-e2aa53896cc2', 'fbc7503e-d3df-59fa-9f7c-df091344d18e', 'India at New Zealand · ODI (4th of 5)', '2026-11-12', 18, 0, 5),
  ('f0465a31-aa0f-56f3-a1f5-6c79fd83e402', 'fbc7503e-d3df-59fa-9f7c-df091344d18e', 'India at New Zealand · ODI (5th of 5)', '2026-11-14', 18, 0, 6),
  ('dcd1ff1e-a839-58c1-a7a2-a7e458a59309', 'fbc7503e-d3df-59fa-9f7c-df091344d18e', 'India at New Zealand · Test (1st of 2), 5 days through Nov 23 (local)', '2026-11-18', 14, 0, 7),
  ('e7b2ee8a-5c01-5c56-82a1-31ef802d6eb7', 'fbc7503e-d3df-59fa-9f7c-df091344d18e', 'India at New Zealand · Test (2nd of 2), 5 days through Dec 1 (local)', '2026-11-26', 14, 0, 8),
  ('82a67110-a142-52a3-b05d-c9153160ec27', 'fbc7503e-d3df-59fa-9f7c-df091344d18e', 'India vs Sri Lanka · ODI (1st of 3)', '2026-12-13', 0, 30, 9),
  ('5207e66b-393f-5e08-8605-6a592a29d0f4', 'fbc7503e-d3df-59fa-9f7c-df091344d18e', 'India vs Sri Lanka · ODI (2nd of 3)', '2026-12-16', 0, 30, 10),
  ('ce6dde23-7600-5658-ab54-febb4bcfe368', 'fbc7503e-d3df-59fa-9f7c-df091344d18e', 'India vs Sri Lanka · ODI (3rd of 3)', '2026-12-19', 0, 30, 11),
  ('3af2cda9-f3a1-50f1-a156-f6443aa8b844', 'fbc7503e-d3df-59fa-9f7c-df091344d18e', 'India vs Sri Lanka · T20I (1st of 3)', '2026-12-22', 5, 30, 12),
  ('94b897f8-47c9-5a34-839f-fe4b2ef946ac', 'fbc7503e-d3df-59fa-9f7c-df091344d18e', 'India vs Sri Lanka · T20I (2nd of 3)', '2026-12-24', 5, 30, 13),
  ('87e13308-7ec8-5231-97c6-143b759cf6c1', 'fbc7503e-d3df-59fa-9f7c-df091344d18e', 'India vs Sri Lanka · T20I (3rd of 3)', '2026-12-27', 5, 30, 14),
  ('4e1d97dc-8443-5996-b0f1-904fe1655a14', 'fbc7503e-d3df-59fa-9f7c-df091344d18e', 'India vs Zimbabwe · ODI (1st of 3)', '2027-01-03', 0, 30, 15),
  ('8117e81e-57a9-5104-80da-d549b6150972', 'fbc7503e-d3df-59fa-9f7c-df091344d18e', 'India vs Zimbabwe · ODI (2nd of 3)', '2027-01-06', 0, 30, 16),
  ('4451a6af-0b8b-5188-87f1-3fdbfd316c7c', 'fbc7503e-d3df-59fa-9f7c-df091344d18e', 'India vs Zimbabwe · ODI (3rd of 3)', '2027-01-09', 0, 30, 17),
  ('09767a2a-982a-52ec-ac8e-817d1e9a5d36', 'fbc7503e-d3df-59fa-9f7c-df091344d18e', 'India vs Australia · Test (1st of 5), 5 days through Jan 25 (local)', '2027-01-20', 20, 0, 18),
  ('55d97093-0d94-54ec-a0d1-5b813b83bbc0', 'fbc7503e-d3df-59fa-9f7c-df091344d18e', 'India vs Australia · Test (2nd of 5), 5 days through Feb 2 (local)', '2027-01-28', 20, 0, 19),
  ('e140a061-b1ff-504f-9d0f-cc0220915f99', 'fbc7503e-d3df-59fa-9f7c-df091344d18e', 'India vs Australia · Test (3rd of 5), 5 days through Feb 15 (local)', '2027-02-10', 19, 30, 20),
  ('4d59c05b-1417-517c-827e-d1d65b49f820', 'fbc7503e-d3df-59fa-9f7c-df091344d18e', 'India vs Australia · Test (4th of 5), 5 days through Feb 23 (local)', '2027-02-18', 20, 0, 21),
  ('36210378-e084-5416-9a57-8b19271ef2b7', 'fbc7503e-d3df-59fa-9f7c-df091344d18e', 'India vs Australia · Test (5th of 5), 5 days through Mar 3 (local)', '2027-02-26', 20, 0, 22);
