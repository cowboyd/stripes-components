import { test } from 'bigtest';
import { Mount } from './helpers';

export default test("KeyValue")
  .step(Mount(<KeyValue
       data-test-foo="bar"
       label="Label"
       value="Value"
       subValue="subValue"
      />))
  .assertion("it is true", async () => {});
