import json, data
json.dump({"cities": data.CITIES, "cities_ar": data.CITIES_AR, "control_city": data.CONTROL_CITY,
           "imagery": [dict(zip(["id","test","en","ar","city","models","look_for"], r)) for r in data.IMAGERY],
           "model_groups": data.MODEL_GROUPS}, open("images/prompts.json","w"), ensure_ascii=False, indent=2)
print("ok")
