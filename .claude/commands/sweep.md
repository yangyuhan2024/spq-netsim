---
description: Run a load sweep for a scenario and summarise the trends
argument-hint: <scenario id, e.g. q1>
---
Run `npm run sim -- sweep --scenario $ARGUMENTS --out results/$ARGUMENTS.csv`.
Then read the CSV and summarise in 5 bullet points: how the reference flow's end-to-end delay
and blocking change with load, where delay starts to rise sharply, and how audio, video and data
compare. Point out anything that looks physically wrong (for example delay decreasing as load
rises, or blocking above zero at low load with a large buffer).
