
tags: fake
	find src test -name '*.js' | xargs ctags

data.json: fake
	rsync -avzP purple:api/ data/
	node scripts/dump.js data/production > data.json

accounts.json: data.json
	jq '.accounts|to_entries' data.json > accounts.json

subscriptions.json: data.json
	./scripts/report.py subs_report

active-subscriptions.json: subscriptions.json
	jq --argjson now "$(shell date +%s)" 'map(select($$now >= .start_date and $$now <= .end_date))' < $^ > $@

active-pubkeys.json: active-subscriptions.json
	jq 'map(.pubkey) | sort | unique' $^ > $@

report: accounts.json
	./scripts/report.py

.PHONY: fake
