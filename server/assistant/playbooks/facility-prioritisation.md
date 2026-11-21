# Prioritising facilities by the people they would serve

For questions like "which broken water pumps are most worth fixing?", "where should the next clinic go?" or "which schools serve the most children?". You need a layer of facilities (usually points) and a layer of where people are (areas or points with a population property).

1. Find the inputs. describe_layer on both. On the facilities, find the property that says which ones are candidates (such as `functional` holding "broken" or "Non-Functional") and check its actual values. On the population layer, find the population property and check it's a number, not text.
2. Split the candidates from the rest with save_filtered_layer, for example broken pumps and working pumps, so each is a layer of its own. Keep the original layer as it is.
3. Draw a catchment around each candidate with buffer. Use the user's distance if they gave one. Otherwise choose a realistic one for the kind of facility and the setting (a walk to a water point is shorter than a trip to a clinic), and tell the user what you chose and why, so they can ask for another.
4. Leave out people already served. If the population layer is areas, turn it into points with centroid first: subtracting from an area would leave a partly served area with all its population. Then buffer the facilities that already work by the same distance, with merge, and subtract that from the population points. Points within reach of a working facility drop out, so they don't count towards fixing a broken one.
5. Add up the people in each catchment with summarize: the catchments as areas, the remaining population points as features, the population property as the field, with sum. Each catchment gets `<property>_sum`.
6. Rank them with get_features on the summary layer, sorted by `<property>_sum` descending, and report the top few with their names or ids and the numbers.
7. Show it: style_layer with a scale on `<property>_sum`, and give the result layers clear names.

Warn about these when they apply:

- Overlapping catchments count the same people more than once, so the totals can't be added together. If catchments overlap a lot, say so, and suggest fixing the top one, then running the analysis again without the people it now serves.
- Each population area counts in full wherever its centre falls. With population areas that are large compared to the catchments, the result is rough; say so.
- Straight-line distance ignores roads, rivers and terrain.
