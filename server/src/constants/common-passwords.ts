// A compact deny-list of the most-used passwords (lower case, letters and digits only). Checked after the password
// is normalised, so "P@ssw0rd!" and "password" are caught by the same entry.
export const COMMON_PASSWORDS: ReadonlySet<string> = new Set([
  'password', 'password1', 'password12', 'password123', 'password1234', 'passw0rd', 'pass1234', 'passpass', 'p4ssword',
  '123456', '1234567', '12345678', '123456789', '1234567890', '0123456789', '11111111', '1111111111', '00000000',
  '12341234', '123123123', '1qaz2wsx', '1q2w3e4r', '1q2w3e4r5t', 'qwerty', 'qwerty1', 'qwerty12', 'qwerty123',
  'qwertyuiop', 'qwertyui', 'asdfghjkl', 'asdfghjk', 'zxcvbnm', 'zxcvbnm1', 'qazwsxedc', 'qweasdzxc', 'abcd1234',
  'abcdefgh', 'abcdefghij', 'abc12345', 'abc123456', 'letmein', 'letmein1', 'letmein123', 'welcome', 'welcome1',
  'welcome123', 'admin', 'admin123', 'admin1234', 'administrator', 'root1234', 'rootroot', 'toor', 'login', 'login123',
  'iloveyou', 'iloveyou1', 'iloveyou123', 'princess', 'princess1', 'sunshine', 'sunshine1', 'monkey', 'monkey123',
  'dragon', 'dragon123', 'master', 'master123', 'shadow', 'shadow123', 'superman', 'batman', 'batman123', 'football',
  'football1', 'baseball', 'cricket', 'cricket123', 'india', 'india123', 'india1234', 'bharat', 'bharat123', 'hindustan',
  'jaishreeram', 'iloveindia', 'sachin', 'dhoni', 'virat', 'virat18', 'mumbai', 'mumbai123', 'delhi', 'delhi123',
  'trustno1', 'whatever', 'freedom', 'michael', 'jennifer', 'jordan23', 'harley', 'ranger', 'hunter', 'hunter2',
  'buster', 'thomas', 'tigger', 'robert', 'soccer', 'killer', 'george', 'charlie', 'andrew', 'michelle', 'jessica',
  'pepper', 'daniel', 'access', 'flower', 'hottie', 'loveme', 'zaq12wsx', 'azerty', 'azerty123', 'qwertz', 'mustang',
  'secret', 'secret123', 'default', 'guest', 'guest123', 'test', 'test123', 'test1234', 'testing', 'testing123',
  'changeme', 'changeme123', 'newpassword', 'mypassword', 'mypassword1', 'yourpassword', 'taskmanager', 'taskmanager1',
  'demo12345', 'demouser', 'user1234', 'username', 'p455w0rd', 'passwort', 'motdepasse', 'contrasena', 'senha123',
  'googlegoogle', 'facebook', 'facebook1', 'instagram', 'whatsapp', 'linkedin', 'github', 'github123', 'nodejs', 'nodejs123',
  'javascript', 'mongodb', 'mongodb123', 'react123', 'reactjs', 'developer', 'developer1', 'hemant', 'hemant123',
  '111111', '222222', '333333', '444444', '555555', '666666', '777777', '888888', '999999', '000000', '121212', '654321',
  '987654321', '9876543210', '123321', '147258369', '159753', '123qwe', '123qweasd', 'qwe123', 'qwe123qwe', 'a1b2c3d4',
]);
